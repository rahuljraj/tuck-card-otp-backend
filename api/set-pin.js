import bcrypt from 'bcrypt';
import { supabase } from '../utils/supabaseClient.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Only POST allowed' });

  const { role, phone_number, pin } = req.body;
  if (!role || !phone_number || !pin) return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    const hashedPin = await bcrypt.hash(pin, 10);
    const table = role === 'admin' ? 'admins' : 'users';

    const { error } = await supabase.from(table).update({ transaction_pin: hashedPin }).eq('phone_number', phone_number);
    if (error) throw error;

    return res.status(200).json({ success: true, message: 'PIN set successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}