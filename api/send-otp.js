const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Only POST allowed' });

  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'Phone required' });

  try {
    const otp = Math.floor(100000 + Math.random() * 900000);
    await client.messages.create({
      to: phone,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: `Your OTP is ${otp}`,
    });

    // Optionally save OTP in Supabase
    return res.status(200).json({ success: true, otp });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
