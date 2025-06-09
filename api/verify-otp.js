const twilio = require('twilio');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Only POST requests allowed' });
  }

  const { phone, code, role } = req.body;

  if (!phone || !code || !role) {
    return res.status(400).json({ success: false, message: 'Phone, code, and role are required' });
  }

  try {
    // ✅ Step 1: Verify OTP with Twilio
    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code });

    if (verificationCheck.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // ✅ Step 2: Role-based validation for "user"
    if (role === 'user') {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone_number', phone)
        .single();

      if (error || !data) {
        return res.status(403).json({ success: false, message: 'User not pre-approved by Admin' });
      }
    }

    // ✅ Step 3: Fetch user from role-specific table
    const { data: user, error: userError } = await supabase
      .from(role === 'admin' ? 'admins' : 'users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        message: 'User not found in Supabase for this role',
        error: userError?.message || 'Not found'
      });
    }

    // ✅ Step 4: Manually generate access token
    const accessToken = jwt.sign(
      {
        sub: user.id,
        role: 'authenticated',
        phone: user.phone
      },
      process.env.SUPABASE_JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ✅ Step 5: Send back session
    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      session: {
        access_token: accessToken,
        token_type: 'bearer'
      },
      user: user
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
