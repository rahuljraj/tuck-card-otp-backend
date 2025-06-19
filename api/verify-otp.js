import { createClient } from '@supabase/supabase-js';

// If you're using Twilio for sending OTP, ensure this is uncommented
// and environment variables are set for TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
 const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- CRITICAL DEBUGGING LOGS (outside the handler to run on cold start) ---
console.log("--- STARTING FUNCTION INIT ---");
console.log(`Node.js Version: ${process.version}`);
console.log("Supabase URL present:", !!supabaseUrl);
console.log("Supabase Service Role Key present:", !!supabaseServiceRoleKey);

// Initialize Supabase admin client with the service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// --- CRITICAL DEBUGGING LOGS (inspecting the client object) ---
console.log("supabaseAdmin object created.");
console.log("Does supabaseAdmin.auth exist?", !!supabaseAdmin.auth);
console.log("Does supabaseAdmin.auth.admin exist?", !!supabaseAdmin.auth.admin);
console.log("Type of supabaseAdmin.auth.admin:", typeof supabaseAdmin.auth.admin);

// This is the MOST IMPORTANT log: it will list all available methods on the admin object.
// We are looking to see if 'getUserByPhone' is in this list.
console.log("Methods on supabaseAdmin.auth.admin:", Object.keys(supabaseAdmin.auth.admin || {}));
console.log("--- ENDING FUNCTION INIT ---");


exports.handler = async (event, context) => {
  // Ensure the function only accepts POST requests
  if (event.httpMethod !== 'POST') {
    console.log("Method Not Allowed:", event.httpMethod); // Log
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { phone, code, role } = JSON.parse(event.body);

    // --- LOGS for incoming request data ---
    console.log(`Received request for phone: ${phone}, code: ${code}, role: ${role}`);

    // Verify OTP with Supabase
    // Note: Supabase uses 'token' for the OTP code, not 'code' directly here.
    console.log("Attempting OTP verification with Supabase...");
    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      phone: phone,
      token: code, // Supabase's parameter for the OTP
      type: 'sms'
    });

    if (error) {
      console.error("OTP Verification Error:", error.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: error.message }),
      };
    }

    if (!data || !data.session || !data.user) {
      console.error("No session or user data returned after OTP verification.");
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'OTP verification failed: No session or user data.' }),
      };
    }

    const { session, user } = data;
    console.log(`OTP Verified. User ID: ${user.id}, Phone: ${user.phone}`);

    // --- CRITICAL LOG: Attempting to call getUserByPhone ---
    console.log("Attempting to get user by phone with supabaseAdmin.auth.admin.getUserByPhone...");
    // Check if the function exists before calling (defensive coding)
    if (typeof supabaseAdmin.auth.admin.getUserByPhone !== 'function') {
      const availableAdminMethods = Object.keys(supabaseAdmin.auth.admin || {});
      console.error("CRITICAL: getUserByPhone is still NOT a function on supabaseAdmin.auth.admin.");
      console.error("Available admin methods:", availableAdminMethods);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: "supabaseAdmin.auth.admin.getUserByPhone is not a function (runtime check)",
          availableMethods: availableAdminMethods
        }),
      };
    }


    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserByPhone(phone);

    if (userError) {
      console.error("Get User By Phone Error:", userError.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: userError.message }),
      };
    }

    if (!userData || !userData.user) {
      console.error("User data not found after getUserByPhone.");
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'User not found or no user data in response.' }),
      };
    }
    console.log("Successfully fetched user data with getUserByPhone:", userData.user.id);


    // Optional: Check if a specific role is required and matches
    const userRole = userData.user.user_metadata?.role;
    if (role && userRole !== role) {
      console.log(`Role mismatch: Expected ${role}, got ${userRole}`);
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: `Unauthorized: User role is ${userRole}, expected ${role}` }),
      };
    }
    console.log(`User role check: ${userRole || 'not set'}. Requested role: ${role || 'any'}.`);


    // Return session and user information if successful
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'OTP verified successfully!',
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          token_type: session.token_type,
        },
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email, // Include email if available and desired
          role: userRole || 'default', // Default role if not set
          // Add any other relevant user_metadata fields you need
        }
      }),
    };

  } catch (e) {
    // Catch any unexpected errors during function execution
    console.error("Caught unhandled error in verify-otp:", e.message, e.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: `Unhandled error: ${e.message}` }),
    };
  }
};