import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    console.log('Loading .env from', envPath);
    dotenv.config({ path: envPath });
} else {
    console.log('.env not found at', envPath);
}

async function checkSchema() {
    try {
        const { supabase } = await import('../src/db/supabase');

        console.log('Attempting to insert a plan with scope_type="personal"...');

        const { data, error } = await supabase
            .from('optional_plans')
            .insert({
                name: 'Schema Check',
                description: 'Temporary check',
                category: 'Test',
                scope_type: 'personal',
                created_by: '00000000-0000-0000-0000-000000000000', // Dummy UUID
                status: 'draft'
            })
            .select()
            .single();

        if (error) {
            console.error('Insert failed:', error.message);
            if (error.message.includes('invalid input value for enum') || error.message.includes('check constraint')) {
                console.log('CONFIRMED: scope_type does not support "personal".');
            }
        } else {
            console.log('Insert successful! scope_type supports "personal".');
            // Clean up
            await supabase.from('optional_plans').delete().eq('id', data.id);
        }

    } catch (err) {
        console.error('Script error:', err);
    }
}

checkSchema();
