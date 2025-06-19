const twilio = require('twilio');

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// The main handler function for Netlify
// It takes event, context, and callback as arguments
exports.handler = async (event, context) => { // Renamed from module.exports
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ success: false, message: 'Only POST requests allowed' })
        };
    }

    // Netlify Functions parse the body automatically if it's JSON and POST
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (parseError) {
        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, message: 'Invalid JSON body' })
        };
    }

    const { phone } = body;

    if (!phone) {
        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, message: 'Phone number is required' })
        };
    }

    try {
        const verification = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SERVICE_SID)
            .verifications.create({ to: phone, channel: 'sms' });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'OTP sent successfully', sid: verification.sid })
        };
    } catch (error) {
        console.error('Error sending OTP:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};