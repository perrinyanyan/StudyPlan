import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error('Usage: npx tsx scripts/make-admin.ts <email>');
        process.exit(1);
    }

    console.log(`Looking up user: ${email}...`);
    const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id')
        .eq('email', email);

    if (uErr) {
        console.error('Failed to fetch user:', uErr);
        process.exit(1);
    }

    if (!users || users.length === 0) {
        console.error('User not found');
        process.exit(1);
    }

    const userId = users[0].id;
    console.log(`Found user ID: ${userId}`);

    console.log('Adding system_admin role...');
    const { error: iErr } = await supabase
        .from('user_roles')
        .insert({
            user_id: userId,
            role: 'system_admin',
            scope_type: 'global'
        });

    if (iErr) {
        console.error('Failed to add role:', iErr);
        process.exit(1);
    }

    console.log('Success! User is now a system_admin.');
}

main();
