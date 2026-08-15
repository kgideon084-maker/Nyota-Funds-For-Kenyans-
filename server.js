require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/', (req, res) => {
    res.json({ status: "Active", service: "Nyota Funds Hashback Backend" });
});

// STK Push Payment Route
app.post('/pay', async (req, res) => {
    try {
        const { phone, amount, grant_amount, full_name, id_number, occupation } = req.body;

        // Basic payload validation
        if (!phone || !amount) {
            return res.status(400).json({ 
                status: "Error", 
                message: "Missing required fields: phone or amount" 
            });
        }

        // Format phone number to standard 254 format if needed
        let formattedPhone = phone.toString().trim();
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('+254')) {
            formattedPhone = formattedPhone.substring(1);
        }

        // Hashback Payload Construct
        const hashbackPayload = {
            api_key: process.env.HASHBACK_API_KEY,
            app_id: process.env.HASHBACK_APP_ID,
            phone_number: formattedPhone,
            amount: Number(amount),
            reference: `GRANT-${id_number || Date.now()}`,
            description: `Activation Fee for KSh ${grant_amount || amount} Grant`
        };

        // Trigger Hashback STK Push API
        const hashbackResponse = await fetch(process.env.HASHBACK_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(hashbackPayload)
        });

        const data = await hashbackResponse.json();

        // Check Hashback API response status
        if (hashbackResponse.ok && (data.success || data.status === "Success" || data.code === "200")) {
            return res.status(200).json({
                status: "Success",
                message: "STK Push initiated successfully",
                data: data
            });
        } else {
            return res.status(400).json({
                status: "Failed",
                message: data.message || data.errorMessage || "Failed to trigger STK Push",
                details: data
            });
        }

    } catch (error) {
        console.error("Payment Processing Error:", error);
        return res.status(500).json({
            status: "Error",
            message: "Internal Server Error during transaction request",
            error: error.message
        });
    }
});

// Hashback IPN / Callback Route (Receives response when user completes payment)
app.post('/callback', (req, res) => {
    const callbackData = req.body;
    console.log("RECEIVED PAYMENT CALLBACK:", JSON.stringify(callbackData, null, 2));

    // Process payment status here (e.g., save transaction status to Database)
    
    // Always acknowledge reception back to Hashback
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Hashback STK Push Server running on port ${PORT}`);
});
