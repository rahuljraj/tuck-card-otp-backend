const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
// const jwt = require('jsonwebtoken'); // You should remove this if it's still being used for manual token generation

// Supabase client with SERVICE_ROLE_KEY for admin actions
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Only POST requests allowed' });
  }

  // Ensure these parameters are consistent with frontend (Flutter sends 'otp', backend expects 'code')
  const { phone, code, role } = req.body;

  if (!phone || !code || !role) {
    return res.status(400).json({ success: false, message: 'Phone, code, and role are required' });
  }

  try {
    // 1. Verify OTP with Twilio
    const verificationCheck = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code });

    if (verificationCheck.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // 2. Role-based validation (check pre-approval in your custom tables)
    let userRecord;
    if (role === 'admin') {
      const { data, error } = await supabaseAdmin
        .from('admins')
        .select('*')
        .eq('phone_number', phone)
        .single();
      if (error || !data) {
        return res.status(403).json({ success: false, message: 'Admin not pre-approved.' });
      }
      userRecord = data; // Keep for potential future use if needed, but not used directly for auth session
    } else if (role === 'user') {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('phone_number', phone)
        .single();
      if (error || !data) {
        return res.status(403).json({ success: false, message: 'User not pre-approved by Admin.' });
      }
      userRecord = data; // Keep for potential future use if needed
    } else {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    // 3. Ensure user exists in Supabase Auth (auth.users table)
    const { data: existingAuthUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserByPhone(phone);

    let authUser;
    if (authUserError && authUserError.message === 'User not found') {
      // User does not exist in Supabase Auth, create them.
      const { data: newAuthUser, error: newAuthUserError } = await supabaseAdmin.auth.admin.createUser({
        phone: phone,
        phone_verified: true,
        user_metadata: { app_role: role } // Store your app-specific role here
      });
      if (newAuthUserError) {
        console.error('Error creating Supabase Auth user:', newAuthUserError);
        return res.status(500).json({ success: false, message: 'Failed to create authentication user.' });
      }
      authUser = newAuthUser.user;
    } else if (authUserError) {
      console.error('Error fetching Supabase Auth user:', authUserError);
      return res.status(500).json({ success: false, message: 'Failed to verify authentication user.' });
    } else {
      authUser = existingAuthUser.user;
      // Ensure user_metadata role is updated if it differs
      if (authUser.user_metadata?.app_role !== role) {
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, { user_metadata: { app_role: role } });
        authUser.user_metadata = { app_role: role }; // Update local object for response
      }
    }

    // 4. Generate a sign-in link/token from Supabase Auth
    const { data: signInLink, error: signInLinkError } = await supabaseAdmin.auth.admin.generateLink(
      'magiclink',
      phone,
      {
        redirectTo: '',
        properties: {},
        user_id: authUser.id
      }
    );

    if (signInLinkError || !signInLink?.properties?.token) {
      console.error('Error generating sign-in link:', signInLinkError);
      return res.status(500).json({ success: false, message: 'Failed to generate authentication token.' });
    }

    const idToken = signInLink.properties.token;

    // 5. Return the ID token and user details to the frontend
    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      id_token: idToken, // THIS IS THE CRITICAL CHANGE
      user: {
        id: authUser.id,
        phone_number: authUser.phone,
        app_role: role,
      }
    });

  } catch (error) {
    console.error('Verification Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};