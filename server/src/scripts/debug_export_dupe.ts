
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars manually
try {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.error('Failed to read .env file', e);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase env vars. CWD:', process.cwd());
    console.log('Env keys:', Object.keys(process.env).filter(k => k.startsWith('SUPABASE')));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log('--- Debugging Export Duplication ---');

    // Pick a plan that likely has issues - usually the first one or browse a few
    const { data: plans } = await supabase.from('optional_plans').select('id, name').limit(10);

    if (!plans || plans.length === 0) {
        console.log('No plans found.');
        return;
    }

    // Iterate all sample plans
    for (const plan of plans) {
        console.log(`\nSimulating export for: ${plan.name} (${plan.id})`);

        const { data: items } = await supabase
            .from('optional_plan_items')
            .select('*')
            .eq('optional_plan_id', plan.id)
            .eq('kind', 'course');

        if (!items || items.length === 0) { console.log('No items'); continue; }

        const courseIds = items.map(i => i.ref_id);
        const { data: courses } = await supabase.from('courses').select('*').in('id', courseIds);
        const courseMap = new Map(courses?.map(c => [c.id, c]) || []);

        const { data: sessions } = await supabase
            .from('course_sessions')
            .select('*')
            .in('course_id', courseIds)
            .order('date', { ascending: true })
            .order('start_time', { ascending: true });

        // console.log(`- Items: ${items.length}, Courses: ${courses?.length}, Sessions: ${sessions?.length}`);

        const rows: string[] = [];
        for (const item of items) {
            const course = courseMap.get(item.ref_id);
            if (!course) continue;

            const courseSessions = sessions?.filter(s => s.course_id === course.id) || [];
            for (const sess of courseSessions) {
                // Simplified row key for duplication check: CourseCode + Date + StartTime
                const key = `${course.code}|${sess.date}|${sess.start_time}`;
                rows.push(key);
            }
        }

        console.log(`- Generated Rows: ${rows.length}`);

        // Check duplicates in rows
        const rowCounts: Record<string, number> = {};
        rows.forEach(r => { rowCounts[r] = (rowCounts[r] || 0) + 1; });
        const dupes = Object.entries(rowCounts).filter(([k, v]) => v > 1);

        if (dupes.length > 0) {
            console.warn(`!!! [${plan.name}] GENERATED ROWS CONTAIN DUPLICATES !!!`);
            console.log(dupes.slice(0, 5));
        } else {
            console.log('Generated rows are unique.');
        }
    }
}

run();
