import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Analyzes qualified vendor bids to compute a composite score, rank them, 
 * and flag potential anomalies or fraudulent indicators.
 * @param {Object} nitBenchmark - The NIT rules and estimated cost.
 * @param {Array} evaluatedBids - An array of evaluated vendor results from previous agents.
 * @returns {Object} Ranked leaderboard and detailed fraud/anomaly risk flags.
 */
export async function evaluateAndRankBids(nitBenchmark, evaluatedBids) {
    const prompt = `
        You are an expert Government Procurement Audit and Tender Ranking Agent.
        Analyze the following competing vendor bids that have passed technical/financial checks against the NIT benchmark.

        NIT BENCHMARK:
        ${JSON.stringify(nitBenchmark, null, 2)}

        EVALUATED VENDOR BIDS:
        ${JSON.stringify(evaluatedBids, null, 2)}

        Your tasks:
        1. Compute a composite score (out of 100) for each vendor based on their financial competitiveness (service charge/quotes) and compliance posture.
        2. Rank them from L1 (Best/Lowest responsive) downwards.
        3. Flag potential fraud, collusive bidding risks, or anomalies (e.g., abnormally low rates below economic feasibility, metadata mismatches, or suspicious patterns).

        Return a valid JSON object strictly matching this schema:
        {
          "tender_reference": "${nitBenchmark.tender_reference || 'N/A'}",
          "total_bids_analyzed": ${evaluatedBids.length},
          "leaderboard": [
            {
              "rank": "L1",
              "vendor_name": "",
              "composite_score": 0,
              "recommendation": "AWARD_RECOMMENDED" or "REJECTED",
              "justification": ""
            }
          ],
          "fraud_and_risk_flags": [
            {
              "vendor_name": "",
              "risk_level": "LOW" | "MEDIUM" | "HIGH",
              "flag_reason": ""
            }
          ]
        }
        Return ONLY the raw JSON block.
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0]?.message?.content || '{}');
    } catch (error) {
        console.error("Error in Recommendation & Fraud Agent:", error);
        throw error;
    }
}