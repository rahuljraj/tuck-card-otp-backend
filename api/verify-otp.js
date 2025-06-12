const twilio = require('twilio');
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

    // ✅ Step 2: Role-based validation (only for 'user')
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

    // ✅ Step 3: Authenticate with Supabase Auth to get full session
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      type: 'sms',
      phone,
      token: code,
    });

    if (sessionError || !sessionData?.session) {
      return res.status(400).json({
        success: false,
        message: 'OTP verification failed via Supabase',
        error: sessionError?.message || 'Unknown error',
      });
    }

    // ✅ Step 4: Return full session (access + refresh token)
    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        token_type: sessionData.session.token_type,
      },
      user: sessionData.user,
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
