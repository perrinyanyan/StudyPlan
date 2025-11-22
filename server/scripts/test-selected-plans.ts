
import { createClient } from '@supabase/supabase-js';
import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const API_URL = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log('--- Test Selected Plans ---');

    // 1. Setup Data
    console.log('Setting up test data...');

    // Create User (Class Admin) manually in public.users
    const email = `admin_${Date.now()}@test.com`;
    const password = 'password123';
    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error: uErr } = await supabase
        .from('users')
        .insert({
            email,
            password_hash,
            nickname: 'Test Admin',
            email_verified_at: new Date().toISOString()
        })
        .select()
        .single();

    if (uErr) throw uErr;
    const userId = user.id;

    // Create School
    const { data: school, error: sErr } = await supabase
        .from('schools')
        .insert({ name: 'Test School' })
        .select()
        .single();
    if (sErr) throw sErr;
    const schoolId = school.id;

    // Create Class
    const { data: cls, error: cErr } = await supabase
        .from('classes')
        .insert({ name: 'Test Class', school_id: schoolId, join_code: `TEST-${Date.now()}` })
        .select()
        .single();
    if (cErr) throw cErr;
    const classId = cls.id;

    // Assign Role
    await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'class_admin',
        scope_type: 'class',
        scope_id: classId
    });

    // Create Optional Plan
    const { data: plan, error: pErr } = await supabase
        .from('optional_plans')
        .insert({
            name: 'Test Plan',
            scope_type: 'class',
            scope_id: classId,
            status: 'published'
        })
        .select()
        .single();
    if (pErr) throw pErr;
    const planId = plan.id;

    // Login to get token
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
        console.error('Login failed:', loginData);
        throw new Error('Login failed');
    }
    const token = loginData.token;

    // 2. Test PUT /:class_id/selected-plan
    console.log('Testing PUT /selected-plan...');
    const putRes = await fetch(`${API_URL}/classes/${classId}/selected-plan`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            optional_plan_id: planId,
            effective_from: '2025-01-01'
        })
    });

    if (putRes.status !== 200) {
        console.error('PUT failed:', await putRes.text());
    } else {
        console.log('PUT success:', await putRes.json());
    }

    // 3. Test GET /:class_id/selected-plan
    console.log('Testing GET /selected-plan...');
    const getRes = await fetch(`${API_URL}/classes/${classId}/selected-plan`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (getRes.status !== 200) {
        console.error('GET failed:', await getRes.text());
    } else {
        const json = await getRes.json();
        console.log('GET success:', json);
        if (json.selected_plan?.optional_plan_id === planId) {
            console.log('VERIFICATION PASSED: Plan ID matches.');
        } else {
            console.error('VERIFICATION FAILED: Plan ID mismatch.');
        }
    }

    // Cleanup
    console.log('Cleaning up...');
    await supabase.from('users').delete().eq('id', userId);
    await supabase.from('classes').delete().eq('id', classId);
    await supabase.from('schools').delete().eq('id', schoolId);
    await supabase.from('optional_plans').delete().eq('id', planId);
}

main().catch(console.error);
