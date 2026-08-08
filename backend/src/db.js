import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 1. Force dotenv to load the variables first
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;

// 2. Safely check for whatever you named the key in your .env file
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

// 3. Add a helpful error log just in case it's still missing
if (!supabaseUrl || !supabaseKey) {
    console.error("❌ ERROR: Missing Supabase credentials in your .env file!");
    console.error("Please ensure SUPABASE_URL and SUPABASE_KEY exist in your .env");
}

// 4. Export the connected client
export const supabase = createClient(supabaseUrl, supabaseKey);