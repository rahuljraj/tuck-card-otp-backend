import twilio from 'twilio';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Only POST requests allowed' });
  }

  const { phone, code, role } = req.body;

  if (!phone || !code || !role) {
    return res.status(400).json({ success: false, message: 'Phone, code, and role are required' });
  }

  try {
    // ✅ 1. Verify OTP with Twilio
    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code });

    if (verificationCheck.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // ✅ 2. Role-based validation
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

    // ✅ 3. Fetch the user
    const { data: user, error: userError } = await supabase
      .from(role === 'admin' ? 'admins' : 'users')
      .select('*')
      .eq('phone_number', phone)
      .single();

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        message: 'User not found in Supabase',
        error: userError?.message || 'Not found'
      });
    }

    // ✅ 4. Create tokens
    const payload = {
      sub: user.id,
      role: 'authenticated',
      phone: user.phone_number
    };

    const accessToken = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, {
      expiresIn: '1h'
    });

    const refreshToken = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, {
      expiresIn: '30d'
    });

    // ✅ 5. Return session
    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer'
      },
      user: user
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
