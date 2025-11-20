import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log('Listing tables...');
    // We can't easily list tables via Supabase JS client without a function, 
    // but we can try to query standard tables or guess.
    // Actually, we can try to select from 'user_roles' in 'public' and 'app' schemas.

    console.log('Checking public.user_roles...');
    const { data: publicData, error: publicError } = await supabase
        .from('user_roles')
        .select('*')
        .limit(1);

    if (publicError) {
        console.log('Error accessing public.user_roles:', publicError);
    } else {
        console.log('Success accessing public.user_roles. Data:', publicData);
    }

    console.log('Attempting test insert into public.user_roles...');
    // Use a random UUID for user_id to avoid FK constraints if possible, 
    // but user_roles likely has FK to users. 
    // We'll use the user ID found in the previous step if available, or skip.

    // We need a valid user ID. Let's fetch one.
    const { data: users } = await supabase.from('users').select('id').limit(1);
    if (users && users.length > 0) {
        const userId = users[0].id;
        console.log('Using user ID:', userId);

        const { error: insertError } = await supabase
            .from('user_roles')
            .insert({
                user_id: userId,
                role: 'student', // Try a safe role
                scope_type: 'global'
            });

        if (insertError) {
            console.log('Insert failed:', insertError);
        } else {
            console.log('Insert successful!');
            // Clean up
            await supabase.from('user_roles').delete().match({ user_id: userId, role: 'student', scope_type: 'global' });
        }
    } else {
        console.log('No users found to test insert.');
    }
}

main();
