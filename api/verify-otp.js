const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ message: 'Phone number and code are required' });
  }

  try {
    const verificationCheck = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks
      .create({ to: phone, code });

    if (verificationCheck.status === 'approved') {
      // ✅ Supabase login
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: code,
        type: 'sms',
      });

      if (error) {
        return res.status(400).json({ success: false, message: error.message });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
