// ✅ verify-otp.js — Supabase OTP + Session Flow
import twilio from 'twilio';
import { supabase } from '../utils/supabaseClient.js';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ success: false, message: 'Only POST allowed' });

  const { phone, code, role } = req.body;
  if (!phone || !code || !role)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    // ✅ 1. Verify OTP
    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code });

    if (verificationCheck.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // ✅ 2. Check if user exists in Supabase Auth
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    let matchedUser = existingUsers.users.find(u => u.phone === phone);
    let userId;

    if (!matchedUser) {
      // ✅ 3. Create Auth User
      const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
        phone,
        phone_confirm: true,
        user_metadata: { role }
      });

      if (createError) {
        // 🔐 Handle duplicate user creation attempt
        if (createError.message.includes('already registered')) {
          matchedUser = existingUsers.users.find(u => u.phone === phone);
          if (!matchedUser) {
            return res.status(400).json({
              success: false,
              message: 'Phone already registered but user not found in Auth list'
            });
          }
          userId = matchedUser.id;
        } else {
          throw createError;
        }
      } else {
        userId = createdUser.user.id;
        matchedUser = createdUser.user;
      }
    } else {
      userId = matchedUser.id;
    }

    // ✅ Final safety check
    if (!userId) {
      return res.status(500).json({
        success: false,
        message: 'User ID could not be resolved'
      });
    }

    // ✅ 4. Insert into role table (admins or users)
    const table = role === 'admin' ? 'admins' : 'users';

    const { data: existingRecord, error: checkError } = await supabase
      .from(table)
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (checkError) throw checkError;

    if (!existingRecord) {
      const { error: insertError } = await supabase.from(table).insert({
        id: userId,
        phone_number: phone,
        transaction_pin: '0000'
      });

      if (insertError) {
        console.error('Insert error:', insertError.message);
        return res.status(500).json({ success: false, message: 'Failed to insert user record' });
      }
    }

    // ✅ 5. Create Session
    const { data: session, error: sessionError } = await supabase.auth.admin.createSession({
      user_id: userId
    });

    if (sessionError) {
      console.error('Session Error:', sessionError.message);
      return res.status(500).json({ success: false, message: 'Failed to create session' });
    }

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
    console.error('❌ Final Error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Internal server error', error: err.message || 'Unknown error' });
  }
}
