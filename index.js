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
// Note: On Vercel, environment variables should be set in the project settings,
// but dotenv.config() won't hurt if it runs and finds no .env file.
dotenv.config();

const app = express();
const port = process.env.PORT || 3001; // Vercel sets the PORT environment variable
const apiKey = process.env.GEMINI_API_KEY; // Make sure this is set in Vercel project settings!

// --- Middleware ---

// Configure CORS to allow your Vercel frontend URL and localhost
const allowedOrigins = [
  'http://localhost:5173', // For local development
  'https://days-of-togetherness.vercel.app' // *** REPLACE with your actual Vercel frontend URL ***
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests) - adjust if needed
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      console.error(msg + " Origin: " + origin); // Log denied origins
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());

// --- Load Prompts from JSON file ---
let promptTemplates = [];
try {
  // Construct the full path relative to the current file's directory
  // Vercel typically keeps the file structure, so this should work if
  // prompt_templates.json is in the same directory as index.js or a known relative path.
  const promptsPath = path.join(__dirname, 'prompt_templates.json');
  console.log(`Attempting to load prompts from: ${promptsPath}`);
  // Use existsSync for a quick check, though readFileSync will throw anyway if not found
  if (fs.existsSync(promptsPath)) {
      const jsonData = fs.readFileSync(promptsPath, 'utf8');
      promptTemplates = JSON.parse(jsonData);
      console.log(`Successfully loaded ${promptTemplates.length} prompt templates.`);
  } else {
      console.error(`Error: prompt_templates.json not found at ${promptsPath}`);
      // Handle the error more gracefully or use fallback
      promptTemplates = ["Happy __DAYS__ days! My love for you grows stronger every moment."];
      console.warn("Using fallback prompt template because file was not found.");
  }
} catch (err) {
  console.error("Error loading or parsing prompt_templates.json:", err);
  // Use a fallback prompt if file loading/parsing fails
  promptTemplates = ["Happy __DAYS__ days! My love for you grows stronger every moment."];
  console.warn("Using fallback prompt template due to error.");
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
    // genAI and model will remain undefined, handled in the endpoint
  }
} else {
    console.warn('Warning: GEMINI_API_KEY environment variable is not set. API calls will fail.');
}


// --- API Endpoint ---
// Note: Vercel routes requests starting with /api/ to this function automatically
// if defined in vercel.json (which yours does). So the base path is handled by Vercel.
app.get('/api/generate-message', async (req, res) => {
  // Log entry point and origin for easier debugging on Vercel
  console.log(`--- Handling GET /api/generate-message --- Request origin: ${req.headers.origin}`);
  const days = req.query.days;
  console.log(`Received request. Days: ${days}`);

  if (!genAI || !model) {
    console.error("Gemini AI client not initialized. Check API Key environment variable on Vercel.");
    // Send a clear error message to the frontend
    return res.status(500).json({ error: "Backend AI service not configured or API key missing." });
  }

  if (!promptTemplates || promptTemplates.length === 0) {
      console.error("Prompt templates array is empty or failed to load.");
      return res.status(500).json({ error: "Server configuration error: No prompts available." });
  }

  const daysInt = parseInt(days);
  if (isNaN(daysInt)) {
      console.warn("Invalid 'days' parameter (NaN). Sending 400 error."); // Use warn level
      return res.status(400).json({ error: "Invalid 'days' parameter provided." });
  }

  try {
    console.log("--- Entering Generation Try Block ---");

    const randomIndex = Math.floor(Math.random() * promptTemplates.length);
    // Ensure template exists before trying to replace (handles edge case if array becomes empty unexpectedly)
    const template = promptTemplates[randomIndex] || "Happy __DAYS__ days!";
    const prompt = template.replace(/__DAYS__/g, daysInt.toString());

    console.log(`Using prompt index ${randomIndex}: "${prompt}"`);

    if (!model) {
        // This check might be redundant due to the check at the start of the function, but belts and suspenders
        console.error("Model object is not available during generation!");
        throw new Error("Generative model not initialized correctly.");
    }

    console.log("--- Calling generateContent ---");
    const result = await model.generateContent(prompt);
    console.log("--- generateContent Finished ---");
    const response = result.response; // Use optional chaining in case result is null/undefined

    if (!response) {
        console.error("No response object received from generateContent result.");
        throw new Error("Empty response object from AI model generation.");
    }

    // Improved check for blocked content or empty candidates
    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        let blockReason = "Blocked or empty content";
        let safetyRatings = null;
        if (response.promptFeedback?.blockReason) {
            blockReason = response.promptFeedback.blockReason;
        } else if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
             blockReason = `Generation stopped: ${candidate.finishReason}`;
             safetyRatings = candidate.safetyRatings;
        } else if (!candidate) {
            blockReason = "No candidates in response.";
        } else if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            blockReason = "Candidate content is empty.";
        }

        console.error("Content generation blocked or failed:", blockReason, safetyRatings ? `Safety Ratings: ${JSON.stringify(safetyRatings)}` : '');
        // Send a more specific error if possible, fallback to generic
        return res.status(400).json({ error: `Message generation failed: ${blockReason}` });
    }

    const text = response.text(); // Safely call text() after checks
    console.log("Generated Text:", text);

    console.log("--- Sending Success JSON ---");
    res.status(200).json({ message: text }); // Explicitly set 200 OK

  } catch (error) {
    console.error("--- Caught Error During Generation ---");
    // Log the full error for debugging
    console.error("Error details:", error);
    // Provide a user-friendly error message
    let errorMessage = "Failed to generate message due to an internal server error.";
    let statusCode = 500;

    // Check for specific error types if needed (e.g., safety blocks, network issues)
    if (error.response?.promptFeedback?.blockReason) {
         errorMessage = `Message generation blocked: ${error.response.promptFeedback.blockReason}`;
         statusCode = 400; // Bad Request might be more appropriate for blocked content
         console.error("Safety Block Reason:", error.response.promptFeedback.blockReason);
    } else if (error.message?.includes("FETCH_ERROR") || error.message?.includes("Network error")) {
         errorMessage = "Network error communicating with AI service.";
         statusCode = 502; // Bad Gateway
    }
    // You might add more specific error checks here

    console.error(`--- Sending Error JSON (Status: ${statusCode}) ---`);
    res.status(statusCode).json({ error: errorMessage });
  }
  console.log("--- Handler End ---");
});

// --- Start Server ---
// Vercel injects its own server logic, so this app.listen is typically
// NOT needed or used when deploying as a serverless function on Vercel.
// However, it's useful for local testing if you run `node index.js` directly.
// Vercel handles starting the server based on the framework/build output.
// You can keep it for local testing or remove it if you only use `npm run dev`.
// If you keep it, ensure it doesn't conflict with Vercel's expectations.
// Often, the export default app; pattern is used for Vercel instead of app.listen.

/* Remove or comment out for Vercel deployment if causing issues
if (process.env.NODE_ENV !== 'production') { // Only listen locally if not in production (Vercel sets NODE_ENV)
    app.listen(port, () => {
      console.log(`Backend server listening locally on http://localhost:${port}`);
    });
}
*/

// Export the app for Vercel
export default app; // <-- Add this line for Vercel
