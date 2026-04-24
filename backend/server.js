const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Update this line to include the version
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/triage', async (req, res) => {
    console.log("Request received...");
    try {
        const { image } = req.body;
        // CHANGE THIS LINE to use 2.5-flash
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = "Analyze this injury. Return ONLY raw JSON with keys: severity (Red, Yellow, or Green), injury_type, and first_aid_steps. No markdown.";

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: image, mimeType: "image/jpeg" } }
        ]);

        const response = await result.response;
        const text = response.text();
        
        // Clean and parse
        const cleanedJson = text.replace(/```json|```/g, "").trim();
        res.json({ data: JSON.parse(cleanedJson) });
        
    } catch (error) {
        console.error("BACKEND ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});