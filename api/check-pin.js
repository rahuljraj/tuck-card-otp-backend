import { supabase } from '../utils/supabaseClient.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Only POST allowed' });

  const { phone_number, role } = req.body;
  const table = role === 'admin' ? 'admins' : 'users';

  try {
    const { data, error } = await supabase.from(table).select('transaction_pin').eq('phone_number', phone_number).single();
    if (error || !data) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, pinSet: data.transaction_pin !== null });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}