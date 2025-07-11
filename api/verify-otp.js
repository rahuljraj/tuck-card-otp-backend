// ✅ verify-otp.js — FINAL Production-Ready API Route for Vercel (Node.js)
import twilio from 'twilio';
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
    // ✅ 1. Verify OTP with Twilio
    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code });

    if (verificationCheck.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // ✅ 2. Check if user exists in Supabase Auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const matchedUser = existingUsers.users.find(u => u.phone === phone);

    let userId;
    if (!matchedUser) {
      // ✅ 3. Create user in Supabase Auth
      const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
        phone,
        phone_confirm: true,
        user_metadata: { role }
      });

      if (createError) throw createError;
      userId = createdUser.user.id;

      // ✅ 4. Insert into `admins` or `users` table
      const table = role === 'admin' ? 'admins' : 'users';
      const { error: insertError } = await supabase.from(table).insert({
        id: userId,
        phone_number: phone
      });
      if (insertError) throw insertError;

    } else {
      userId = matchedUser.id;
    }

    // ✅ 5. Create Session
    const { data: session, error: sessionError } = await supabase.auth.admin.createSession({ user_id: userId });
    if (sessionError) throw sessionError;

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      session,
      user: {
        id: userId,
        phone_number: phone,
        role
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
