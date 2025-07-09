import twilio from 'twilio';
import jwt from 'jsonwebtoken';
import { supabase } from '../utils/supabaseClient.js';


const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Only POST allowed' });

  const { phone, code, role } = req.body;
  if (!phone || !code || !role) return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code });

    if (verificationCheck.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    const table = role === 'admin' ? 'admins' : 'users';
    const { data: user, error } = await supabase.from(table).select('*').eq('phone_number', phone).single();
    if (error || !user) return res.status(403).json({ success: false, message: 'User not found' });

    const payload = { sub: user.id, role: 'authenticated', phone: user.phone_number };
    const accessToken = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, { expiresIn: '30d' });

    return res.status(200).json({
      success: true,
      message: 'OTP verified',
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer'
      },
      user: { ...user, role }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

