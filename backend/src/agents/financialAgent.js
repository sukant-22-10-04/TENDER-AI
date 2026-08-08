import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Evaluates a vendor's financial BOQ quote against the pricing rules.
 * @param {Object} nitBenchmark - The financial rules from the NIT.
 * @param {Object} financialBid - The pricing details from the vendor's Cover 2.
 * @returns {Object} Financial evaluation score and response status.
 */
export async function evaluateFinancials(nitBenchmark, financialBid) {
    const minServiceCharge = nitBenchmark.financial_rules?.minimum_service_charge_percent || 5.0;

    const prompt = `
        You are an expert Financial Procurement Agent. 
        Analyze the vendor's financial quote against the mandatory floor rule.

        MANDATORY RULE: Quoted service charge percentage must be >= ${minServiceCharge}%.

        VENDOR FINANCIAL DATA:
        ${JSON.stringify(financialBid, null, 2)}

        Return a valid JSON object:
        {
          "vendor_name": "${financialBid.vendor_name}",
          "quoted_service_charge_percent": 0.0,
          "meets_minimum_floor": true/false,
          "financial_status": "RESPONSIVE" or "UNRESPONSIVE",
          "remarks": ""
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
        console.error("Error in Financial Agent:", error);
        throw error;
    }
}