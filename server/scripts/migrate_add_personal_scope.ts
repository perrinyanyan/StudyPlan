import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
    console.log('Adding "personal" to app.scope_type enum...');

    // We use a raw SQL query via RPC if available, or we might need to use a direct connection if RPC 'exec_sql' is not available.
    // Based on previous history, 'exec_sql' RPC exists.

    const sql = `
        ALTER TYPE app.scope_type ADD VALUE IF NOT EXISTS 'personal';
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Migration failed:', error);
        // Fallback: If exec_sql doesn't exist, we might be stuck unless we have direct PG access.
        // But let's assume it works as per previous tasks.
    } else {
        console.log('Migration successful: Added "personal" to scope_type.');
    }
}

migrate();
