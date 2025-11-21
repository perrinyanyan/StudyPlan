import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQuery() {
    console.log('Testing DB connection...');
    const start = Date.now();

    try {
        // 1. List plans
        console.log('Fetching one plan...');
        const { data: plans, error: pErr } = await supabase
            .from('optional_plans')
            .select('id, name')
            .limit(1);

        if (pErr) throw pErr;
        console.log(`Plan fetch took ${Date.now() - start}ms`);

        if (!plans || plans.length === 0) {
            console.log('No plans found.');
            return;
        }

        const planId = plans[0].id;
        console.log(`Testing details query for plan: ${plans[0].name} (${planId})`);

        const t2 = Date.now();
        const { data: items, error: iErr } = await supabase
            .from('optional_plan_items')
            .select('*')
            .eq('optional_plan_id', planId);

        if (iErr) throw iErr;
        console.log(`Items fetch took ${Date.now() - t2}ms. Found ${items?.length || 0} items.`);

        if (items && items.length > 0) {
            const courseIds = items.filter((i: any) => i.kind === 'course').map((i: any) => i.ref_id);
            console.log(`Course IDs: ${courseIds.length}`);

            if (courseIds.length > 0) {
                const t3 = Date.now();
                const { data: courses, error: cErr } = await supabase
                    .from('courses')
                    .select('*')
                    .in('id', courseIds);
                if (cErr) throw cErr;
                console.log(`Courses fetch took ${Date.now() - t3}ms`);

                const t4 = Date.now();
                const { data: sessions, error: sErr } = await supabase
                    .from('course_sessions')
                    .select('*')
                    .in('course_id', courseIds);
                if (sErr) throw sErr;
                console.log(`Sessions fetch took ${Date.now() - t4}ms. Found ${sessions?.length || 0} sessions.`);
            }
        }

        console.log('DB Test Complete. Everything looks responsive.');

    } catch (err) {
        console.error('DB Test Failed:', err);
    }
}

testQuery();
