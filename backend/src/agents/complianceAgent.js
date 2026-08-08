import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Evaluates a vendor's technical proposal against the NIT compliance benchmark.
 * @param {Object} nitBenchmark - The parsed rules from the NIT extraction agent.
 * @param {Object} vendorBid - The parsed technical text or metadata from the vendor's Cover 1.
 * @returns {Object} Compliance status, pass/fail state, and detected risks.
 */
export async function evaluateCompliance(nitBenchmark, vendorBid) {
    const prompt = `
        You are an expert Government Procurement Compliance Agent. 
        Compare the following Vendor Bid against the official NIT Benchmark Rules.

        NIT BENCHMARK RULES:
        ${JSON.stringify(nitBenchmark, null, 2)}

        VENDOR BID DATA (COVER 1):
        ${JSON.stringify(vendorBid, null, 2)}

        Evaluate the following strictly and return a valid JSON object:
        {
          "vendor_name": "${vendorBid.vendor_name}",
          "emd_verified": true/false,
          "turnover_meets_threshold": true/false,
          "enlistment_valid": true/false,
          "fssai_compliant": true/false,
          "compliance_status": "PASS" or "FAIL",
          "failure_reasons": []
        }
        Return ONLY the raw JSON block without markdown formatting wrappers if possible.
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
        console.error("Error in Compliance Agent:", error);
        throw error;
    }
}