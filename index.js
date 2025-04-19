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


// --- !!! ARRAY OF PROMPT TEMPLATES !!! ---
// Expand this list with more unique prompts!
const promptTemplates = [
  // == Prompts Inspired by Static Site Content ==
  \`Celebrating ${daysInt} days! Write a message about how even the ordinary becomes extraordinary with my partner.\`,
  \`For ${daysInt} days together, write a short, heartfelt message about the beauty that unfolds when two souls connect, like ours have.\`,
  \`It's been ${daysInt} days. Create a message reflecting on how my partner has been a 'lifeline in the dark' for me.\`,
  \`Write a loving message for ${daysInt} days together, comparing our connection to exploring the 'deep cosmos' side-by-side.\`,
  \`Generate a romantic message for ${daysInt} days, mentioning how my partner's presence built a 'bridge straight to my heart'.\`,
  \`It's ${daysInt} days! Write a message about how my partner's love illuminates my world, like sunshine.\`,
  \`Create a message for ${daysInt} days together, describing my partner as a 'masterpiece of soul and starlight'.\`,
  \`For ${daysInt} days, write about how truly listening and recognizing each other's souls instantly connected us.\`,
  \`Generate a message for ${daysInt} days, mentioning how their presence 'stills the chaos' and brings peace.\`,

  // == Standard Loving & Appreciative ==
  \`Write a short, heartfelt message for my partner celebrating ${daysInt} days together. Focus on appreciation for their presence.\`,
  \`Create a sweet and loving 2-3 sentence message for my partner, marking ${daysInt} days of our journey. Mention a feeling they inspire.\`,
  \`Generate a unique, romantic message for ${daysInt} days together. Express how much they mean to me. Keep it concise but meaningful.\`,
  \`It's been ${daysInt} days! Write a simple, direct message telling my partner how much I love them.\`,
  \`For ${daysInt} wonderful days, write a message expressing gratitude for my partner just being themselves.\`,
  \`Create a message celebrating ${daysInt} days, focusing on how happy my partner makes me.\`,
  \`Generate a warm message for ${daysInt} days together, telling my partner they are my favorite person.\`,
  \`Write a loving note for ${daysInt} days, simply saying 'I cherish you'.\`,
  \`Happy ${daysInt} days! Create a message telling my partner I'm so glad we found each other.\`,
  \`Generate a message for ${daysInt} days expressing how much I admire my partner.\`,

  // == Reflective / Journey-focused ==
  \`Reflecting on ${daysInt} days together, write a short message about how our bond has grown stronger.\`,
  \`Write a message celebrating ${daysInt} days with my partner. Mention looking back on our memories and forward to our future.\`,
  \`Generate a thoughtful message for ${daysInt} days together, acknowledging a small, everyday thing I cherish about our relationship.\`,
  \`It's ${daysInt} days. Write a message about a specific happy memory we've made together.\`,
  \`For ${daysInt} days, create a message reflecting on a challenge we overcame together and how it strengthened us.\`,
  \`Generate a message celebrating ${daysInt} days and the beautiful story we are writing together, one day at a time.\`,
  \`Write a message about learning and growing alongside my partner over these ${daysInt} days.\`,
  \`Thinking back over ${daysInt} days, write a message about a moment I knew our connection was special.\`,
  \`Generate a message for ${daysInt} days about how our love has evolved.\`,

  // == Playful / Fun ==
  \`Write a fun and loving message for my partner celebrating ${daysInt} days! Include a lighthearted compliment or a playful emoji feeling.\`,
  \`Create a short, cheerful message for ${daysInt} days together, mentioning how they make even ordinary moments exciting.\`,
  \`Generate a slightly cheeky but loving message for ${daysInt} days with my partner, maybe mentioning an inside joke (conceptually).\`,
  \`It's ${daysInt} days! Write a message about how my partner is my favorite adventure buddy.\`,
  \`For ${daysInt} days, create a fun message celebrating our unique brand of weirdness together.\`,
  \`Generate a playful message for ${daysInt} days, telling my partner they still give me butterflies.\`,
  \`Happy ${daysInt} days to my partner in crime! Write a fun, short message.\`,
  \`Write a message for ${daysInt} days celebrating how much we laugh together.\`,

  // == Poetic / Descriptive ==
  \`Write a short, slightly poetic message celebrating ${daysInt} days together, using a metaphor for our love (like a favorite song, warm fire, anchor, compass etc.).\`,
  \`Create a beautiful 2-sentence message for ${daysInt} days, focusing on the feeling of 'home' I find with my partner.\`,
  \`Generate a message for ${daysInt} days together, describing my partner with an appreciative adjective (e.g., radiant, steadfast, inspiring, captivating).\`,
  \`It's ${daysInt} days. Write a poetic snippet about the magic found in our connection.\`,
  \`For ${daysInt} days, create a message comparing my partner's smile or laugh to something beautiful (like sunshine, stars, music).\`,
  \`Generate a short, artistic message about the 'color' my partner brings to my world after ${daysInt} days.\`,
  \`Write a message for ${daysInt} days using imagery of nature (like seasons, ocean, mountains) to describe our love.\`,
  \`Create a short message for ${daysInt} days about the quiet beauty of our love.\`,

  // == Future-oriented ==
  \`Write a loving message for ${daysInt} days together, expressing excitement for all the days and adventures still to come.\`,
  \`Create a short message celebrating ${daysInt} days, focusing on building our dreams and future together.\`,
  \`Generate a hopeful and loving message for ${daysInt} days, mentioning a specific future dream we share.\`,
  \`It's ${daysInt} days down, and a lifetime to go! Write a message expressing anticipation for our future adventures.\`,
  \`For ${daysInt} days, create a message about looking forward to growing old and making more memories together.\`,
  \`Generate a sweet message for ${daysInt} days, saying I can't wait to see what the next chapter holds for us.\`,
  \`Write a message for ${daysInt} days celebrating the journey ahead, hand-in-hand.\`,

  // == Slightly Longer / Deeper ==
  \`Write a heartfelt message of about 3-4 sentences celebrating ${daysInt} days with my partner. Express deep gratitude and love.\`,
  \`Generate a slightly longer, reflective message for ${daysInt} days together, touching on both the joys and the comfort of our relationship.\`,
  \`Create a meaningful message for ${daysInt} days, expressing how my partner helps me be a better person.\`,
  \`Write a 3-sentence message for ${daysInt} days about the trust and security I feel in our relationship.\`,
  \`Generate a slightly longer message about the deep understanding and connection we share after ${daysInt} days.\`,
  \`For ${daysInt} days, write a message expressing profound appreciation for their unwavering love and support.\`,
  \`Create a message for ${daysInt} days about the profound impact my partner has had on my life.\`,

  // == Simple & Sweet ==
  \`${daysInt} days of loving you. Write a short, sweet message expressing this simple sentiment.\`,
  \`Celebrating ${daysInt} days with my amazing partner. Generate a simple, loving sentence.\`,
  \`Write a quick, happy message for ${daysInt} days together!\`,
  \`Generate a one-sentence message saying 'Happy ${daysInt} days, my love! Here's to many more.'\`
  // ... feel free to add many more prompts here! ...
];
// --- !!! END PROMPT TEMPLATES ARRAY !!! ---


// --- API Endpoint ---
app.get('/api/generate-message', async (req, res) => {
  console.log("--- Handler Start ---");
  const days = req.query.days;
  console.log(\`Received request. Days: \${days}\`);

  if (!genAI || !model) {
    console.error("Gemini AI client not initialized or API key missing.");
    return res.status(500).json({ error: "Backend AI service not configured" });
  }

  const daysInt = parseInt(days);
  if (isNaN(daysInt)) {
      console.log("Invalid 'days' parameter (NaN). Sending error.");
      return res.status(400).json({ error: "Invalid 'days' parameter provided." });
  }

  try {
    console.log("--- Entering Try Block ---");

    // --- !!! RANDOMLY SELECT A PROMPT !!! ---
    const randomIndex = Math.floor(Math.random() * promptTemplates.length);
    // Use template literals directly if they are already defined that way,
    // otherwise, use a method to replace a placeholder if needed.
    // This approach assumes templates might contain ${daysInt} directly.
    // CAUTION: Using eval can be risky if templates aren't controlled.
    let prompt;
    try {
      // Attempt to evaluate the template string to inject daysInt
      prompt = eval('`' + promptTemplates[randomIndex] + '`');
    } catch (e) {
       console.error("Error evaluating prompt template:", e);
       // Fallback or handle error - perhaps use a default prompt
       prompt = \`Happy \${daysInt} days together! My love for you grows every day.\`;
    }

    console.log(\`Using prompt index \${randomIndex}: "\${prompt}"\`);
    // --- !!! END RANDOM SELECTION !!! ---


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
             blockReason = \`Generation stopped: \${response.candidates[0].finishReason}\`;
             if (response.candidates[0].safetyRatings) {
                 blockReason += \` - Safety: \${JSON.stringify(response.candidates[0].safetyRatings)}\`;
             }
        }
        console.error("Content generation blocked or failed:", blockReason);
        // Send a more informative error, maybe still 400 for safety blocks
        return res.status(400).json({ error: \`Message generation blocked or failed: \${blockReason}\` });
    }

    const text = response.text();
    console.log("Generated Text:", text);

    console.log("--- Sending Success JSON ---");
    res.json({ message: text });

  } catch (error) {
    console.error("--- Caught Error ---");
    console.error("Error calling Gemini API or processing response:", error);
    console.error("--- Sending Error JSON ---");

    // Refined error checking based on potential API responses
    if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
         console.error("Safety Block Reason:", error.response.promptFeedback.blockReason);
         res.status(400).json({ error: \`Message generation blocked: \${error.response.promptFeedback.blockReason}\` });
    } else if (error.message && error.message.includes("FETCH_ERROR")) {
         res.status(502).json({ error: "Network error communicating with AI service." });
    }
     else {
         res.status(500).json({ error: error.message || "Failed to generate message from API" });
    }
  }
  console.log("--- Handler End ---");
});

// --- Start Server ---
app.listen(port, () => {
  console.log(\`Backend server listening on http://localhost:\${port}\`);
});
