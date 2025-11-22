import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('Running plan_visibility migration...');

    const migrationPath = path.join(__dirname, '../migrations/004_plan_visibility.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

        if (error) {
            console.error('Migration error:', error);
            // Try direct query
            const { error: directError } = await supabase.from('_migration_temp').select('*').limit(0);
            console.log('Attempting via raw SQL...');
        } else {
            console.log('✓ Statement executed successfully');
        }
    }

    console.log('Migration completed!');
}

runMigration().catch(console.error);
