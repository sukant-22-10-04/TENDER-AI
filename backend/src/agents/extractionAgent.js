import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

// Initialize the Google GenAI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function to pause execution before retrying
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extracts key evaluation rules and benchmarks from an uploaded NIT PDF buffer.
 * Includes exponential backoff/retry logic for API stability.
 * @param {Buffer} pdfBuffer - The raw PDF file buffer.
 * @param {number} maxRetries - Maximum number of API calls before failing.
 * @returns {Object} Structured JSON containing evaluation criteria.
 */
export async function extractNITBenchmark(pdfBuffer, maxRetries = 3) {
    // Convert the PDF buffer directly into a format Gemini can read natively
    const pdfPart = {
        inlineData: {
            data: pdfBuffer.toString("base64"),
            mimeType: "application/pdf"
        },
    };

    const prompt = `
        You are an expert Procurement AI Agent. Analyze the attached Notice Inviting Tender (NIT) document 
        and extract the following fields strictly into a valid JSON object format:
        {
          "tender_reference": "",
          "estimated_cost_rupees": 0,
          "emd_amount_rupees": 0,
          "bid_submission_closing_date": "",
          "mandatory_requirements": {
            "requires_dcwe_enlistment": true,
            "requires_fssai": true,
            "minimum_average_turnover_rupees": 0
          },
          "financial_rules": {
            "minimum_service_charge_percent": 5.0
          }
        }
        Return ONLY the valid JSON block. No markdown wrappers around the JSON if possible.
    `;

    // Loop to handle temporary 503 high-demand errors from Google's free tier
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Gemini API] Attempt ${attempt} to extract NIT data...`);
            
            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: [pdfPart, prompt],
            });

            const rawText = response.text.trim();
            
            // Clean up markdown block formatting if Gemini includes it
            const cleanedJSON = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            return JSON.parse(cleanedJSON);

        } catch (error) {
            console.warn(`[Gemini API Error] Attempt ${attempt} failed: ${error.message}`);
            
            // If we've reached the max retries, throw the error to the frontend
            if (attempt === maxRetries) {
                throw new Error(`Gemini API failed after ${maxRetries} attempts: ${error.message}`);
            }

            // Wait 2 seconds before trying again
            console.log(`[Gemini API] Waiting 2 seconds before retrying...`);
            await sleep(2000);
        }
    }
}