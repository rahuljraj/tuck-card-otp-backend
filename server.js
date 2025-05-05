require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.json());

// Get credentials from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// Initialize Twilio client
const client = twilio(accountSid, authToken);

// Route to send OTP
app.post('/send-otp', (req, res) => {
    console.log('Received request body:', req.body);
    const { phoneNumber } = req.body;
    client.verify
        .services(verifyServiceSid)
        .verifications.create({
            to: phoneNumber,
            channel: 'sms'
        })
        .then(verification => {
            res.send({ success: true, message: 'OTP sent successfully', data: verification });
        })
        .catch(error => {
            console.error('Error sending OTP:', error); // log error
            res.status(500).send({ success: false, message: 'Failed to send OTP', error });
        });
});

// Route to verify OTP
app.post('/verify-otp', (req, res) => {
    console.log('Received verify request body:', req.body);
    const { phoneNumber, code } = req.body;
    client.verify
        .services(verifyServiceSid)
        .verificationChecks.create({
            to: phoneNumber,
            code: code
        })
        .then(verification_check => {
            if (verification_check.status === 'approved') {
                res.send({ success: true, message: 'OTP verified successfully', data: verification_check });
            } else {
                res.send({ success: false, message: 'Invalid OTP', data: verification_check });
            }
        })
        .catch(error => {
            console.error('Error verifying OTP:', error); // log error
            res.status(500).send({ success: false, message: 'Failed to verify OTP', error });
        });
});

// ✅ START the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
