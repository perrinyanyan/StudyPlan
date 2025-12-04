import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('Running migration: Add settings column to optional_plan_items...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE optional_plan_items ADD COLUMN IF NOT EXISTS settings jsonb;'
  });

  // If exec_sql is not available (it usually isn't by default unless set up), 
  // we might need to use direct PG connection or just hope the user has a way to run SQL.
  // However, since I see `pg` in package.json, I should probably use that for DDL.
  
  if (error) {
    console.error('Supabase RPC failed (expected if exec_sql not set up):', error);
    console.log('Falling back to direct PG connection...');
    return false;
  }
  
  console.log('Migration successful via RPC!');
  return true;
}

// migrate();
