import express from 'express';
import multer from 'multer';
import { extractNITBenchmark } from '../agents/extractionAgent.js';
import { supabase } from '../db.js';

const router = express.Router();
// Keep the file in memory buffer so we can send it directly to Supabase
const upload = multer({ storage: multer.memoryStorage() }); 

router.post('/parse-nit', upload.single('nit_file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No NIT PDF file uploaded.' });
        }

        // 1. Format the filename to be unique
        const safeOriginalName = req.file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        const fileName = `nit_${Date.now()}_${safeOriginalName}`;

        // 2. Upload the PDF buffer to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('nits') // Ensure this bucket exists and is public in Supabase
            .upload(fileName, req.file.buffer, { contentType: 'application/pdf' });

        if (uploadError) throw uploadError;

        // 3. Get the public URL for the uploaded PDF
        const { data: publicUrlData } = supabase.storage.from('nits').getPublicUrl(fileName);
        const fileUrl = publicUrlData.publicUrl;

        // 4. Extract the benchmark using Gemini Flash
        const benchmarkSchema = await extractNITBenchmark(req.file.buffer);
        const tenderReference = benchmarkSchema.tender_reference || `TENDER-${Date.now()}`;

      // 5. Save or Update the record in the Supabase 'tenders' table
            const { data: dbData, error: dbError } = await supabase
                .from('tenders')
                .upsert([{ // Changed from 'insert' to 'upsert'
                    tender_reference: tenderReference,
                    file_path: fileUrl,
                    nit_benchmark: benchmarkSchema
                }], { onConflict: 'tender_reference' }) // Tells Supabase what column to check for duplicates
                .select(); 

        if (dbError) throw dbError;

        res.status(200).json({
            success: true,
            message: 'NIT file stored in Supabase and parsed successfully.',
            tender_reference: tenderReference,
            file_url: fileUrl,
            benchmark: benchmarkSchema
        });

    } catch (error) {
        console.error("Supabase Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lookup Endpoint for n8n Workflow
router.get('/lookup', async (req, res) => {
    try {
        const { reference } = req.query;
        
        // Query Supabase for the matching reference
        const { data, error } = await supabase
            .from('tenders')
            .select('*')
            .eq('tender_reference', reference) // Similar to SQL WHERE clause
            .single(); // Expect only one result

        if (error || !data) return res.status(404).json({ error: 'Tender not found in database.' });

        res.status(200).json({ success: true, tender: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;