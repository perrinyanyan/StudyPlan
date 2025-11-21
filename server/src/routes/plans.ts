import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// Middleware to get user info
async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.slice(7);
    let userId: string;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        userId = payload.sub;
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    (req as any).userId = userId;
    next();
}

// List plans visible to user
router.get('/', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token' });
    }

    const token = authHeader.slice(7);
    let userId: string;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        userId = payload.sub;
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Fetch user roles to determine visibility
    const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

    const { data: memberships } = await supabase
        .from('class_memberships')
        .select('class_id')
        .eq('user_id', userId);

    const userRoles = roles || [];
    const classIds = memberships?.map(m => m.class_id) || [];

    // Build query
    // Visibility:
    // 1. scope_type = 'global'
    // 2. scope_type = 'school' AND scope_id IN (user's school roles)
    // 3. scope_type = 'class' AND scope_id IN (user's class roles OR memberships)
    // 4. scope_type = 'personal' AND created_by = user.id

    const schoolIds = userRoles
        .filter(r => r.scope_type === 'school')
        .map(r => r.scope_id)
        .filter(Boolean);

    const adminClassIds = userRoles
        .filter(r => r.scope_type === 'class')
        .map(r => r.scope_id)
        .filter(Boolean);

    const allClassIds = [...new Set([...classIds, ...adminClassIds])];

    let query = supabase.from('optional_plans').select('*');

    const { data: plans, error: planError } = await query.order('created_at', { ascending: false });

    if (planError) return res.status(500).json({ error: planError.message });

    const visiblePlans = plans.filter(p => {
        if (p.scope_type === 'global') return true;
        if (p.scope_type === 'school' && schoolIds.includes(p.scope_id)) return true;
        if (p.scope_type === 'class' && allClassIds.includes(p.scope_id)) return true;
        if (p.scope_type === 'personal' && p.created_by === userId) return true;
        return false;
    });

    res.json({ plans: visiblePlans });
});

// Get plan details
router.get('/:id', async (req: Request, res: Response) => {
    console.log(`[${new Date().toISOString()}] GET /plans/${req.params.id} request received`);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No auth header');
        return res.status(401).json({ error: 'No token' });
    }

    const token = authHeader.slice(7);
    let userId: string;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        userId = payload.sub;
    } catch (e) {
        console.log('Invalid token', e);
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;

    // 1. Get Plan
    console.log(`[${new Date().toISOString()}] Fetching plan ${id}...`);
    const { data: plan, error: planErr } = await supabase
        .from('optional_plans')
        .select('*')
        .eq('id', id)
        .single();

    if (planErr || !plan) {
        console.error('Plan details: Plan not found or error', planErr);
        return res.status(404).json({ error: 'Plan not found' });
    }
    console.log(`[${new Date().toISOString()}] Plan fetched: ${plan.name}`);

    // 2. Check visibility (reuse logic or simplify)
    // For MVP, we'll assume if you can see the list, you can see details.

    // 3. Get Items
    console.log(`[${new Date().toISOString()}] Fetching items...`);
    const { data: items, error: itemsErr } = await supabase
        .from('optional_plan_items')
        .select('*')
        .eq('optional_plan_id', id);

    if (itemsErr) {
        console.error('Plan details: Failed to fetch items', itemsErr);
        return res.status(500).json({ error: itemsErr.message });
    }
    console.log(`[${new Date().toISOString()}] Items fetched: ${items.length}`);

    // 4. Get Courses and Sessions manually (Manual Join)
    const courseIds = items
        .filter(i => i.kind === 'course')
        .map(i => i.ref_id);

    if (courseIds.length > 0) {
        // Fetch courses
        console.log(`[${new Date().toISOString()}] Fetching courses: ${courseIds.length}...`);
        const { data: courses, error: courseErr } = await supabase
            .from('courses')
            .select('*')
            .in('id', courseIds);

        if (courseErr) {
            console.error('Plan details: Failed to fetch courses', courseErr);
            return res.status(500).json({ error: courseErr.message });
        }

        // Fetch sessions
        console.log(`[${new Date().toISOString()}] Fetching sessions...`);
        const { data: sessions, error: sessErr } = await supabase
            .from('course_sessions')
            .select('*')
            .in('course_id', courseIds);

        if (sessErr) {
            console.error('Plan details: Failed to fetch sessions', sessErr);
            return res.status(500).json({ error: sessErr.message });
        }
        console.log(`[${new Date().toISOString()}] Sessions fetched: ${sessions?.length}`);

        // Map data
        const courseMap = new Map(courses?.map(c => [c.id, c]));

        const detailedItems = items.map(item => {
            if (item.kind !== 'course') return item;

            const course = courseMap.get(item.ref_id);
            if (!course) {
                return { ...item, course: { code: 'ERR', name: 'Unknown Course', sessions: [] } };
            }

            const courseSessions = sessions?.filter(s => s.course_id === course.id) || [];
            return {
                ...item,
                course: {
                    ...course,
                    sessions: courseSessions
                }
            };
        });

        console.log(`[${new Date().toISOString()}] Response ready.`);
        res.json({ plan, items: detailedItems });
    } else {
        res.json({ plan, items: [] });
    }
});

// Import CSV
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('Import: No auth header');
        return res.status(401).json({ error: 'No token' });
    }

    const token = authHeader.slice(7);
    let userId: string;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        userId = payload.sub;
    } catch (err) {
        console.error('Import: JWT verification failed', err);
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const csvData = parse(req.file.buffer.toString(), {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        if (csvData.length === 0) return res.status(400).json({ error: 'Empty CSV' });

        // Validate required columns
        const requiredCols = ['plan_name', 'category', 'course_code', 'course_name', 'date', 'start_time', 'end_time'];
        const headers = Object.keys(csvData[0] as object);
        const missing = requiredCols.filter(c => !headers.includes(c));
        if (missing.length > 0) return res.status(400).json({ error: `Missing columns: ${missing.join(', ')}` });

        interface CSVRow {
            plan_name: string;
            category?: string;
            course_code: string;
            course_name: string;
            date: string;
            start_time: string;
            end_time: string;
            location?: string;
        }

        const rows = csvData as CSVRow[];

        // 1. Create Optional Plan
        const firstRow = rows[0];
        const planName = firstRow.plan_name;
        const category = firstRow.category || 'General';

        // Determine scope from request body or default to personal
        const scopeType = req.body.scope_type || 'personal';
        const scopeId = req.body.scope_id || null;

        const { data: plan, error: planErr } = await supabase
            .from('optional_plans')
            .insert({
                name: planName,
                category,
                description: `Imported from CSV on ${new Date().toLocaleDateString()}`,
                scope_type: scopeType,
                scope_id: scopeId,
                created_by: userId,
                status: 'published'
            })
            .select()
            .single();

        if (planErr) throw new Error('Failed to create plan: ' + planErr.message);

        // 2. Process rows
        const processedCourses = new Map<string, string>(); // code -> id

        for (const row of rows) {
            let courseId = processedCourses.get(row.course_code);

            if (!courseId) {
                // Check if course exists
                const { data: existing } = await supabase
                    .from('courses')
                    .select('id')
                    .eq('code', row.course_code)
                    .single();

                if (existing) {
                    courseId = existing.id;
                } else {
                    // Create course
                    const { data: newCourse, error: cErr } = await supabase
                        .from('courses')
                        .insert({
                            code: row.course_code,
                            name: row.course_name,
                            term: '2025-Spring' // Default or from CSV
                        })
                        .select()
                        .single();

                    if (cErr) throw new Error('Failed to create course: ' + cErr.message);
                    courseId = newCourse.id;
                }
                processedCourses.set(row.course_code, courseId!);

                // Link course to plan
                await supabase.from('optional_plan_items').insert({
                    optional_plan_id: plan.id,
                    kind: 'course',
                    ref_id: courseId
                });
            }

            // Create session
            const { error: sErr } = await supabase
                .from('course_sessions')
                .insert({
                    course_id: courseId!,
                    date: row.date,
                    start_time: row.start_time,
                    end_time: row.end_time,
                    location: row.location || 'TBD'
                });

            if (sErr) console.error('Failed to create session:', sErr);
        }

        res.json({ success: true, planId: plan.id });

    } catch (err: any) {
        console.error('Import error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Apply plan items to schedule
router.post('/:id/apply', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token' });
    }

    const token = authHeader.slice(7);
    let userId: string;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        userId = payload.sub;
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    const { courses } = req.body; // Array of {courseId, settings}

    if (!Array.isArray(courses) || courses.length === 0) {
        return res.status(400).json({ error: 'No courses provided' });
    }

    try {
        // Get User Timezone
        const { data: us } = await supabase
            .from('user_settings')
            .select('timezone')
            .eq('user_id', userId)
            .maybeSingle();
        const tz = us?.timezone || 'Asia/Shanghai';

        // Collect all course IDs
        const courseIds = courses.map((c: any) => c.courseId);

        // Get Sessions for all courses
        const { data: sessions, error: sessErr } = await supabase
            .from('course_sessions')
            .select('*, course:courses(code, name)')
            .in('course_id', courseIds);

        if (sessErr) throw new Error(sessErr.message);
        if (!sessions || sessions.length === 0) {
            return res.json({ success: true, count: 0, message: 'No sessions found for selected courses' });
        }

        // Build a map of courseId -> settings
        const settingsMap = new Map();
        courses.forEach((c: any) => {
            settingsMap.set(c.courseId, c.settings);
        });

        // Create Tasks and Blocks
        let createdCount = 0;

        for (const session of sessions) {
            const courseId = session.course_id;
            const settings = settingsMap.get(courseId) || { type: 'Class', priority: 1, tags: [] };

            const startAt = new Date(`${session.date}T${session.start_time}`);
            const endAt = new Date(`${session.date}T${session.end_time}`);

            const durationMin = (endAt.getTime() - startAt.getTime()) / 60000;

            const courseCode = (session.course as any)?.code || '';
            const courseName = (session.course as any)?.name || 'Unknown Course';

            const tags = [...(settings.tags || [])];
            if (courseCode && !tags.includes(courseCode)) tags.push(courseCode);

            const { data: task, error: tErr } = await supabase
                .from('tasks')
                .insert({
                    user_id: userId,
                    title: courseName,
                    type: settings.type || 'Class',
                    due_at: endAt.toISOString(),
                    estimate_min: durationMin,
                    priority: settings.priority ?? 1,
                    scheduling_status: 'scheduled',
                    status: 'open'
                })
                .select('id')
                .single();

            if (tErr) {
                console.error('Failed to create task for session', session.id, tErr);
                continue;
            }

            const { error: bErr } = await supabase
                .from('time_blocks')
                .insert({
                    user_id: userId,
                    task_id: task.id,
                    start_at: startAt.toISOString(),
                    end_at: endAt.toISOString()
                });

            if (bErr) {
                console.error('Failed to create block for task', task.id, bErr);
            }

            if (tags.length > 0) {
                const upserts = tags.map(n => ({ user_id: userId, name: n }));
                await supabase.from('tags').upsert(upserts, { onConflict: 'user_id,name' });

                const { data: tagRows } = await supabase
                    .from('tags')
                    .select('id,name')
                    .eq('user_id', userId)
                    .in('name', tags);

                if (tagRows) {
                    const links = tagRows.map(r => ({ task_id: task.id, tag_id: r.id }));
                    await supabase.from('task_tags').upsert(links, { onConflict: 'task_id,tag_id' });
                }
            }

            createdCount++;
        }

        res.json({ success: true, count: createdCount });

    } catch (err: any) {
        console.error('Apply plan error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
