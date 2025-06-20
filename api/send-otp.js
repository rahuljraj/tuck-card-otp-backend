// Example: api/send-otp.js
import { createClient } from '@supabase/supabase-js';
const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Or PUBLIC_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { phone } = JSON.parse(event.body);

    if (!phone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Phone number is required.' }),
      };
    }

    // Supabase Phone Sign-in/OTP Request
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phone,
      options: {
        channel: 'sms',
      },
    });

    if (error) {
      console.error("Supabase OTP send error:", error.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: error.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'OTP sent successfully!' }),
    };

  } catch (e) {
    console.error("Caught unhandled error in send-otp:", e.message, e.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: e.message }),
    };
  }
};