import express from 'express';
import multer from 'multer';
import { supabase } from '../db.js'; 

const router = express.Router();

// Multer setup for multipart/form-data parsing (in-memory)
const upload = multer({ storage: multer.memoryStorage() });

// GET route to fetch all bids for a specific tender (Used by frontend leaderboard)
router.get('/list', async (req, res) => {
    const tenderReference = req.query.reference;
    
    if (!tenderReference) {
        return res.status(400).json({ success: false, error: "Reference is required" });
    }
    
    try {
        const { data, error } = await supabase
            .from('bids')
            .select('*')
            .eq('tender_reference', tenderReference);

        if (error) throw error;

        // If any bids have an explicit numeric placement, sort by it ascending
        let bids = data || [];
        const hasPlacement = bids.some(b => b && (b.placement !== null && b.placement !== undefined));

        if (hasPlacement) {
            bids.sort((a, b) => {
                const pa = a.placement === null || a.placement === undefined ? Infinity : Number(a.placement);
                const pb = b.placement === null || b.placement === undefined ? Infinity : Number(b.placement);
                if (pa === pb) return new Date(b.created_at) - new Date(a.created_at);
                return pa - pb;
            });
        } else {
            // fallback: most recent first
            bids.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        // Add a convenience field `display_rank` for the frontend
        bids = bids.map((b, idx) => ({
            ...b,
            display_rank: (b.placement !== null && b.placement !== undefined) ? Number(b.placement) : null
        }));

        res.json({ success: true, bids });
    } catch (error) {
        console.error("Error fetching bids:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST route to ingest a fully evaluated bid into Supabase
// Accept multipart form (single file field 'bid_files') or JSON bodies
router.post('/ingest', upload.single('bid_files'), async (req, res) => {
    try {
        // Safety guard: if req or req.body is undefined, default to an empty object
        let rawBody = req.body || {};
        if (Array.isArray(rawBody)) {
            rawBody = rawBody[0] || {};
        }

        // Safely check all possible locations where tender_reference could be hidden
        const tender_reference = 
            rawBody.tender_reference || 
            rawBody.tenderReference || 
            rawBody.reference || 
            rawBody.evaluation?.compliance?.tender_reference || 
            "UNKNOWN_TENDER";

        const vendor_name = rawBody.vendor_name || rawBody.vendor || "Unknown Vendor";

        // Parse cover objects which may be sent as JSON strings from n8n
        let cover1 = rawBody.cover_1_technical || rawBody.cover1 || rawBody.cover_1 || null;
        let cover2 = rawBody.cover_2_financial || rawBody.cover2 || rawBody.cover_2 || null;
        try {
            if (typeof cover1 === 'string') cover1 = JSON.parse(cover1);
        } catch (e) { /* leave as string if parsing fails */ }
        try {
            if (typeof cover2 === 'string') cover2 = JSON.parse(cover2);
        } catch (e) { /* leave as string if parsing fails */ }

        // Build evaluation object expected by rest of the system
        const evaluation = rawBody.evaluation || {
            compliance: cover1 || {},
            financial: cover2 || {},
            overall_status: rawBody.status || 'PENDING'
        };

        const financial = evaluation.financial || {};
        const quoted_service_charge_percent = financial.quoted_service_charge_percent || rawBody.quoted_service_charge_percent || null;
        const status = evaluation.overall_status || rawBody.status || 'PENDING';

        // Optional ranking fields (may be provided by ranking agent or n8n)
        const placement = rawBody.placement || rawBody.rank || rawBody.rank_number || null; // numeric placement 1,2,3
        const rank_label = rawBody.rank_label || rawBody.rankLabel || null; // e.g., L1
        const composite_score = rawBody.composite_score || rawBody.compositeScore || null;

        // If a file was uploaded, attach basic metadata into evaluation.files
        if (req.file) {
            evaluation.files = evaluation.files || [];
            evaluation.files.push({
                fieldname: req.file.fieldname,
                originalname: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size
            });
        }

        if (!tender_reference || tender_reference === "UNKNOWN_TENDER") {
            console.error("Ingest error: Received payload was:", req.body);
            return res.status(400).json({ 
                success: false, 
                error: "tender_reference is missing or undefined in the request body." 
            });
        }

        // Insert safely into Supabase
        const { data, error } = await supabase
            .from('bids')
            .insert([
                {
                    tender_reference,
                    vendor_name,
                    quoted_service_charge_percent,
                    status,
                    evaluation,
                    placement,
                    rank_label,
                    composite_score
                }
            ])
            .select();

        if (error) throw error;

        const savedBid = data ? data[0] : {};

        res.status(201).json({ 
            success: true, 
            message: "Evaluated bid successfully saved to database!",
            tender_reference: savedBid.tender_reference || tender_reference,
            vendor_name: savedBid.vendor_name || vendor_name,
            evaluation: savedBid.evaluation || evaluation,
            status: savedBid.status || status
        });
    } catch (error) {
        console.error("Error saving evaluated bid:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
export default router;