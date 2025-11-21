import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log('Checking optional_plans columns...');

    // Try to select the new columns
    const { data, error } = await supabase
        .from('optional_plans')
        .select('id, description, category, created_by')
        .limit(1);

    if (error) {
        console.log('Error selecting columns (some might be missing):', error.message);
    } else {
        console.log('All columns exist and are accessible.');
    }
}

main();
