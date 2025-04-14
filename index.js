import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Correct import for the currently installed package
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3001; // Use port from .env or default to 3001
const apiKey = process.env.GEMINI_API_KEY;

// --- Middleware ---
// Enable CORS for requests from your frontend origin
app.use(cors({ origin: 'http://localhost:5173' })); // Allow frontend (default Vite port)
app.use(express.json()); // To parse JSON request bodies

// --- Initialize Gemini AI Client ---
let genAI;
let model;
if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    // Corrected model name
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Gemini AI Client Initialized.");
  } catch (error) {
    console.error("Failed to initialize Gemini AI Client:", error);
    // The server will still start, but API calls will fail later
  }
} else {
    console.warn('Warning: GEMINI_API_KEY is not set. API calls will fail.');
}


// --- API Endpoint ---
app.get('/api/generate-message', async (req, res) => {
  console.log("--- Handler Start ---"); // <-- Logging Added
  const days = req.query.days;
  console.log(`Received request. Days: ${days}`); // <-- Logging Added

  // Check if Gemini Client is initialized and model exists
  if (!genAI || !model) {
    console.error("Gemini AI client not initialized or API key missing."); // <-- Logging Added
    return res.status(500).json({ error: "Backend AI service not configured" });
  }

  // Optional: Validate 'days' parameter more robustly
  const daysInt = parseInt(days);
  if (isNaN(daysInt)) { // Check if it's Not-a-Number
      console.log("Invalid 'days' parameter (NaN). Sending error."); // <-- Logging Added
      // Consider sending a 400 Bad Request status
      return res.status(400).json({ error: "Invalid 'days' parameter provided." });
  }

  try {
    console.log("--- Entering Try Block ---"); // <-- Logging Added
    const prompt = `Write a short, unique, loving message for my partner celebrating ${daysInt} days together. Be creative and heartfelt. Maximum 2 sentences.`;
    console.log(`Generating content with prompt: "${prompt}"`); // <-- Logging Added

    // Ensure 'model' is defined and valid before calling generateContent
    if (!model) {
        console.error("Model object is not available!"); // <-- Logging Added
        throw new Error("Generative model not initialized correctly.");
    }

    console.log("--- Calling generateContent ---"); // <-- Logging Added
    const result = await model.generateContent(prompt);
    console.log("--- generateContent Finished ---"); // <-- Logging Added
    const response = await result.response;

    // Add check for response existence before calling text()
    if (!response) {
        console.error("No response received from generateContent result."); // <-- Logging Added
        throw new Error("Empty response from AI model generation.");
    }

    const text = response.text();
    console.log("Generated Text:", text); // <-- Logging Added

    console.log("--- Sending Success JSON ---"); // <-- Logging Added
    res.json({ message: text });

  } catch (error) {
    console.error("--- Caught Error ---"); // <-- Logging Added
    // Log the detailed error object
    console.error("Error calling Gemini API or processing response:", error); // <-- Logging Added
    console.error("--- Sending Error JSON ---"); // <-- Logging Added

    // Check for specific safety/block reasons if available in the error object
    // (Adjust path to promptFeedback based on actual error structure if needed)
    if (error.response?.promptFeedback?.blockReason) {
         console.error("Safety Block Reason:", error.response.promptFeedback.blockReason); // Log safety reason
         res.status(400).json({ error: `Message generation blocked: ${error.response.promptFeedback.blockReason}` }); // Send 400 for safety blocks
    } else {
         // Send a generic 500 Internal Server Error for other issues
         res.status(500).json({ error: "Failed to generate message from API" });
    }
  }
  console.log("--- Handler End ---"); // <-- Logging Added
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
  // Initial warning moved to client initialization block
});
