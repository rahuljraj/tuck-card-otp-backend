import { supabase } from '../utils/supabaseClient.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Only POST allowed' });

  const { phone, role } = req.body;
  if (!phone || !role) return res.status(400).json({ success: false, message: 'Missing phone or role' });

  if (role === 'admin') return res.status(200).json({ success: true });

  const { data, error } = await supabase.from('users').select('*').eq('phone_number', phone).single();
  if (error || !data) return res.status(403).json({ success: false, message: 'User not pre-approved by Admin' });

  return res.status(200).json({ success: true });
}
