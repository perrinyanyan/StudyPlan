import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { supabase } from '../db/supabase.js';
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
function requireAuth(req) {
    const auth = req.headers['authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer '))
        return null;
    // Courses endpoints (import/list) for MVP: trust server role and skip JWT decode; front-end should pass a valid token
    // Optional: decode JWT if needed
    return { userId: 'any' };
}
function toTimeStr(hm) {
    // Normalize HH:mm or H:mm to HH:MM:SS
    const parts = hm.split(':');
    const h = parts[0].padStart(2, '0');
    const m = (parts[1] || '00').padStart(2, '0');
    return `${h}:${m}:00`;
}
router.post('/import', upload.single('file'), async (req, res) => {
    const auth = requireAuth(req);
    if (!auth)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file)
        return res.status(400).json({ error: 'file is required (multipart/form-data, field name: file)' });
    const csvText = req.file.buffer.toString('utf8');
    let records = [];
    try {
        records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
    }
    catch (e) {
        return res.status(400).json({ error: 'Invalid CSV' });
    }
    const required = ['course_code', 'course_name', 'term', 'date', 'start_time', 'end_time', 'instructor', 'attendance_policy'];
    if (records.length === 0)
        return res.status(400).json({ error: 'CSV has no rows' });
    const headers = Object.keys(records[0] || {});
    for (const k of required) {
        if (!headers.includes(k))
            return res.status(400).json({ error: `Missing column: ${k}` });
    }
    // Build unique courses by (code, term)
    const uniqKeys = new Map();
    for (const r of records) {
        const code = String(r.course_code || '').trim();
        const name = String(r.course_name || '').trim();
        const term = String(r.term || '').trim();
        const key = `${code}||${term}`;
        if (!uniqKeys.has(key))
            uniqKeys.set(key, { code, name, term });
    }
    // Resolve or create courses
    const courseIdByKey = new Map();
    for (const [key, { code, name, term }] of uniqKeys.entries()) {
        const { data: existing, error: selErr } = await supabase
            .from('courses')
            .select('id, name')
            .eq('code', code)
            .eq('term', term)
            .maybeSingle();
        if (selErr)
            return res.status(500).json({ error: 'DB error (select course)' });
        if (existing) {
            courseIdByKey.set(key, existing.id);
            // Optionally update name if different
            if (existing.name !== name && name) {
                await supabase.from('courses').update({ name }).eq('id', existing.id);
            }
        }
        else {
            const { data: ins, error: insErr } = await supabase
                .from('courses')
                .insert({ code, name, term })
                .select('id')
                .single();
            if (insErr || !ins)
                return res.status(500).json({ error: 'DB error (insert course)' });
            courseIdByKey.set(key, ins.id);
        }
    }
    // Prepare sessions
    const sessions = [];
    for (const r of records) {
        const code = String(r.course_code || '').trim();
        const term = String(r.term || '').trim();
        const key = `${code}||${term}`;
        const course_id = courseIdByKey.get(key);
        if (!course_id)
            continue; // should not happen
        const date = String(r.date || '').trim();
        const start_time = toTimeStr(String(r.start_time || '').trim());
        const end_time = toTimeStr(String(r.end_time || '').trim());
        const instructor = String(r.instructor || '').trim();
        const attendance_policy = String(r.attendance_policy || '').trim();
        if (!instructor || !attendance_policy) {
            return res.status(400).json({ error: 'instructor and attendance_policy are required in every row' });
        }
        // Basic time check
        if (end_time <= start_time) {
            return res.status(400).json({ error: `end_time must be after start_time (row with ${code} ${date})` });
        }
        sessions.push({
            course_id,
            date,
            start_time,
            end_time,
            location: (r.location || '').trim() || null,
            class_id: null, // MVP: not mapping CSV class_code -> classes.id
            instructor,
            attendance_policy,
        });
    }
    if (sessions.length > 0) {
        const { error: sessErr } = await supabase.from('course_sessions').insert(sessions);
        if (sessErr)
            return res.status(500).json({ error: 'DB error (insert sessions)' });
    }
    res.json({ courses: courseIdByKey.size, sessions: sessions.length });
});
router.get('/', async (req, res) => {
    const term = typeof req.query.term === 'string' ? req.query.term : undefined;
    const school_id = typeof req.query.school_id === 'string' ? req.query.school_id : undefined;
    let q = supabase.from('courses').select('*');
    if (term)
        q = q.eq('term', term);
    if (school_id)
        q = q.eq('school_id', school_id);
    const { data, error } = await q.order('name', { ascending: true });
    if (error)
        return res.status(500).json({ error: 'Failed to list courses' });
    res.json({ items: data });
});
router.get('/:id/sessions', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('course_sessions')
        .select('*')
        .eq('course_id', id)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });
    if (error)
        return res.status(500).json({ error: 'Failed to list sessions' });
    res.json({ items: data });
});
export default router;
