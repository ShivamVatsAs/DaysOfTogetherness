import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs'; // <-- Import Node.js File System module
import path from 'path'; // <-- Import Path module
import { fileURLToPath } from 'url'; // <-- Import helper for __dirname in ES modules
import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper to get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const apiKey = process.env.GEMINI_API_KEY;

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// --- Load Prompts from JSON file ---
let promptTemplates = []; // Initialize as empty array
try {
  // Construct the full path to the JSON file
  const promptsPath = path.join(__dirname, 'prompt_templates.json');
  console.log(`Attempting to load prompts from: ${promptsPath}`); // Log path
  const jsonData = fs.readFileSync(promptsPath, 'utf8');
  promptTemplates = JSON.parse(jsonData);
  console.log(`Successfully loaded ${promptTemplates.length} prompt templates.`);
} catch (err) {
  console.error("Error loading prompt_templates.json:", err);
  // Use a fallback prompt if file loading fails
  promptTemplates = ["Happy __DAYS__ days! My love for you grows stronger every moment."];
  console.warn("Using fallback prompt template.");
}
// ------------------------------------

// --- Initialize Gemini AI Client ---
let genAI;
let model;
if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Gemini AI Client Initialized.");
  } catch (error) {
    console.error("Failed to initialize Gemini AI Client:", error);
  }
} else {
    console.warn('Warning: GEMINI_API_KEY is not set. API calls will fail.');
}


// --- API Endpoint ---
app.get('/api/generate-message', async (req, res) => {
  console.log("--- Handler Start ---");
  const days = req.query.days;
  console.log(`Received request. Days: ${days}`);

  if (!genAI || !model) {
    console.error("Gemini AI client not initialized or API key missing.");
    return res.status(500).json({ error: "Backend AI service not configured" });
  }

  if (promptTemplates.length === 0) {
      console.error("Prompt templates array is empty or failed to load.");
      return res.status(500).json({ error: "Server configuration error: No prompts available." });
  }

  const daysInt = parseInt(days);
  if (isNaN(daysInt)) {
      console.log("Invalid 'days' parameter (NaN). Sending error.");
      return res.status(400).json({ error: "Invalid 'days' parameter provided." });
  }

  try {
    console.log("--- Entering Try Block ---");

    // --- !!! RANDOMLY SELECT A PROMPT TEMPLATE !!! ---
    const randomIndex = Math.floor(Math.random() * promptTemplates.length);
    const template = promptTemplates[randomIndex];

    // --- !!! REPLACE PLACEHOLDER WITH ACTUAL DAYS !!! ---
    const prompt = template.replace(/__DAYS__/g, daysInt.toString()); // Use replaceAll or regex with 'g' flag

    console.log(`Using prompt index ${randomIndex}: "${prompt}"`);
    // --- !!! END PROMPT PREPARATION !!! ---


    if (!model) {
        console.error("Model object is not available!");
        throw new Error("Generative model not initialized correctly.");
    }

    console.log("--- Calling generateContent ---");
    const result = await model.generateContent(prompt);
    console.log("--- generateContent Finished ---");
    const response = await result.response;

    if (!response) {
        console.error("No response received from generateContent result.");
        throw new Error("Empty response from AI model generation.");
    }

    // Check for blocked content
    if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
        let blockReason = "Unknown reason";
        if (response.promptFeedback && response.promptFeedback.blockReason) {
            blockReason = response.promptFeedback.blockReason;
        } else if (response.candidates && response.candidates.length > 0 && response.candidates[0].finishReason !== 'STOP') {
             blockReason = `Generation stopped: ${response.candidates[0].finishReason}`;
             if (response.candidates[0].safetyRatings) {
                 blockReason += ` - Safety: ${JSON.stringify(response.candidates[0].safetyRatings)}`;
             }
        }
        console.error("Content generation blocked or failed:", blockReason);
        return res.status(400).json({ error: `Message generation blocked or failed: ${blockReason}` });
    }

    const text = response.text();
    console.log("Generated Text:", text);

    console.log("--- Sending Success JSON ---");
    res.json({ message: text });

  } catch (error) {
    console.error("--- Caught Error ---");
    console.error("Error calling Gemini API or processing response:", error);
    console.error("--- Sending Error JSON ---");

    if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
         console.error("Safety Block Reason:", error.response.promptFeedback.blockReason);
         res.status(400).json({ error: `Message generation blocked: ${error.response.promptFeedback.blockReason}` });
    } else if (error.message && error.message.includes("FETCH_ERROR")) {
         res.status(502).json({ error: "Network error communicating with AI service." });
    } else {
         res.status(500).json({ error: error.message || "Failed to generate message from API" });
    }
  }
  console.log("--- Handler End ---");
});
