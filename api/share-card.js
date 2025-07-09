import { supabase } from '../utils/supabaseClient.js';
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Only POST allowed' });

  const { card_id, shared_with_user, shared_by_admin, phone_number } = req.body;
  if (!card_id || !shared_with_user || !shared_by_admin || !phone_number) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await client.messages.create({
      body: `Your OTP to access the shared card is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${phone_number}`
    });

    const { data, error } = await supabase.from('shared_cards').insert([{
      card_id,
      shared_with_user,
      shared_by_admin,
      otp,
      is_verified: false
    }]);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Card shared with OTP', data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
