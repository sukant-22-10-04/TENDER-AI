import express from 'express';
import { evaluateCompliance } from '../agents/complianceAgent.js';
import { evaluateFinancials } from '../agents/financialAgent.js';
import { evaluateAndRankBids } from '../agents/recommendationAgent.js';
import { supabase } from '../db.js';

const router = express.Router();

// POST endpoint to run parallel scoring agents for a vendor bid
router.post('/evaluate-bid', async (req, res) => {
    try {
        const { nitBenchmark, vendorBid } = req.body;

        if (!nitBenchmark || !vendorBid) {
            return res.status(400).json({ error: 'Missing nitBenchmark or vendorBid data in request body.' });
        }

        console.log(`Starting parallel evaluation for: ${vendorBid.vendor_name}`);

        // Run Compliance and Financial agents concurrently using Promise.all
        const [complianceResult, financialResult] = await Promise.all([
            evaluateCompliance(nitBenchmark, vendorBid.cover_1_technical),
            evaluateFinancials(nitBenchmark, vendorBid.cover_2_financial)
        ]);

        res.status(200).json({
            success: true,
            tender_reference: nitBenchmark.tender_reference || vendorBid.tender_reference, // <-- ADD THIS LINE
            vendor_name: vendorBid.vendor_name, // Changed from 'vendor' to match your ingest route
            evaluation: {
                compliance: complianceResult,
                financial: financialResult,
                overall_status: (complianceResult.compliance_status === 'PASS' && financialResult.financial_status === 'RESPONSIVE') 
                    ? 'TECHNICALLY AND FINANCIALLY QUALIFIED' 
                    : 'DISQUALIFIED'
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST endpoint to rank competing vendor bids and flag fraud risks
router.post('/rank-bids', async (req, res) => {
    try {
        const { nitBenchmark, evaluatedBids } = req.body;

        if (!nitBenchmark || !evaluatedBids || !Array.isArray(evaluatedBids)) {
            return res.status(400).json({ error: 'Missing nitBenchmark or evaluatedBids array in request body.' });
        }

        console.log(`Running Recommendation & Fraud Detection Agent for ${evaluatedBids.length} vendors...`);

        const rankingResult = await evaluateAndRankBids(nitBenchmark, evaluatedBids);

        // Persist ranking results back to Supabase (if leaderboard present)
        try {
            if (rankingResult && Array.isArray(rankingResult.leaderboard)) {
                // leaderboard expected to be array with entries including vendor_name, rank (e.g., L1), composite_score
                for (const entry of rankingResult.leaderboard) {
                    const vendor = entry.vendor_name;
                    const rankLabel = entry.rank || entry.rank_label || entry.rankLabel || null;
                    // Convert L1/L2 to numeric placement if possible
                    let placement = null;
                    if (typeof rankLabel === 'string') {
                        const m = rankLabel.match(/L?(\d+)/i);
                        if (m) placement = Number(m[1]);
                    } else if (typeof entry.rank === 'number') {
                        placement = entry.rank;
                    }

                    const composite_score = entry.composite_score || entry.compositeScore || entry.composite || null;

                    if (vendor) {
                        await supabase
                            .from('bids')
                            .update({ placement, rank_label: rankLabel, composite_score })
                            .eq('tender_reference', nitBenchmark.tender_reference)
                            .eq('vendor_name', vendor);
                    }
                }
            }
        } catch (err) {
            console.error('Error persisting ranking to Supabase:', err.message || err);
        }

        res.status(200).json({
            success: true,
            analysis: rankingResult
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;