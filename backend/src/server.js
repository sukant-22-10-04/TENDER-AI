import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tenderRoutes from './routes/tenders.js';
import evaluationRoutes from './routes/evaluation.js';
import bidRoutes from './routes/bids.js';

dotenv.config();


// Mount the webhook ingestion routes

const app = express();
app.use(cors());





app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount the modular routes
app.use('/api/v1/tenders', tenderRoutes);
app.use('/api/v1/bids', bidRoutes);
app.use('/api/v1/evaluation', evaluationRoutes);

app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'ONLINE', 
        message: 'Tender Evaluator Engine is active with Gemini & Groq parallel agents.' 
    });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running locally on http://localhost:${PORT}`);
});