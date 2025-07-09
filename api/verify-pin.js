import bcrypt from 'bcrypt';
import { supabase } from '../utils/supabaseClient.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Only POST allowed' });

  const { role, phone_number, pin } = req.body;
  if (!role || !phone_number || !pin) return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    const table = role === 'admin' ? 'admins' : 'users';
    const { data, error } = await supabase.from(table).select('transaction_pin').eq('phone_number', phone_number).single();
    if (error || !data?.transaction_pin) return res.status(404).json({ success: false, message: 'PIN not found' });

    const match = await bcrypt.compare(pin, data.transaction_pin);
    return match
      ? res.status(200).json({ success: true, message: 'PIN verified' })
      : res.status(401).json({ success: false, message: 'Invalid PIN' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}