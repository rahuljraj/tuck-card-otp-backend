const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST allowed' });
  }

  const { phone, role } = req.body;

  if (!phone || !role) {
    return res.status(400).json({ success: false, message: 'Phone and role are required' });
  }

  if (role === 'admin') {
    return res.status(200).json({ success: true, message: 'Admin can proceed to OTP' });
  }

  // For users – check if phone is pre-approved
  if (role === 'user') {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone)
      .single();

    if (error || !data) {
      return res.status(403).json({ success: false, message: 'User not pre-approved by Admin' });
    }

    return res.status(200).json({ success: true, message: 'User can proceed to OTP' });
  }

  return res.status(400).json({ success: false, message: 'Invalid role' });
};
