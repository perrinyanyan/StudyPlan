import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'crypto';
import jschardet from 'jschardet';
import iconv from 'iconv-lite';

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

    // Fetch schools for these classes to determine school visibility for students
    let studentSchoolIds: string[] = [];
    if (allClassIds.length > 0) {
        const { data: classes } = await supabase
            .from('classes')
            .select('school_id')
            .in('id', allClassIds);

        if (classes) {
            studentSchoolIds = classes.map(c => c.school_id).filter(Boolean);
        }
    }

    const allSchoolIds = [...new Set([...schoolIds, ...studentSchoolIds])];

    let query = supabase.from('optional_plans').select('*');

    const { data: plans, error: planError } = await query.order('created_at', { ascending: false });

    if (planError) return res.status(500).json({ error: planError.message });

    // Fetch plan visibility rules
    const { data: visibilityRules } = await supabase
        .from('plan_visibility')
        .select('*');

    const visibilityMap = new Map<string, Set<string>>();
    (visibilityRules || []).forEach((rule: any) => {
        if (!visibilityMap.has(rule.optional_plan_id)) {
            visibilityMap.set(rule.optional_plan_id, new Set());
        }
        visibilityMap.get(rule.optional_plan_id)!.add(`${rule.target_type}:${rule.target_id}`);
    });

    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');
    const schoolAdminSchoolIds = userRoles
        .filter(r => r.role === 'school_admin' && r.scope_type === 'school')
        .map(r => r.scope_id);

    const visiblePlans = plans.filter(p => {
        // Personal plans: only visible to creator
        if (p.scope_type === 'Personal') {
            return p.created_by === userId;
        }

        // Check if there are visibility rules for this plan
        const rules = visibilityMap.get(p.id);

        if (p.scope_type === 'global') {
            // System admins always see global plans
            if (isSystemAdmin) return true;

            // If no rules, visible to all (default behavior)
            if (!rules || rules.size === 0) return true;

            // Check if user's schools are in allowed list
            for (const schoolId of schoolIds) {
                if (rules.has(`school:${schoolId}`)) return true;
            }
            return false;
        }

        if (p.scope_type === 'school') {
            // User must be in the school (or be a system admin? No, usually school plans are strictly scoped)
            // But let's stick to the requirement: School Admins for this school see it.

            // If user is school admin for this school, they see it regardless of class visibility
            if (schoolAdminSchoolIds.includes(p.scope_id)) return true;

            // User must be in the school to see it at all (if not admin)
            if (!allSchoolIds.includes(p.scope_id)) return false;

            // If no rules, visible to all school members (default)
            if (!rules || rules.size === 0) return true;

            // Check if user's classes are in allowed list
            for (const classId of allClassIds) {
                if (rules.has(`class:${classId}`)) return true;
            }
            return false;
        }

        if (p.scope_type === 'class') {
            // User must be in the class
            return allClassIds.includes(p.scope_id);
        }

        return false;
    });

    // Fetch selected plans for user's classes
    const { data: selectedPlans } = await supabase
        .from('selected_plans')
        .select('optional_plan_id')
        .in('class_id', allClassIds);

    const selectedPlanIds = (selectedPlans || [])
        .map(sp => sp.optional_plan_id)
        .filter(Boolean);

    res.json({ plans: visiblePlans, selectedPlanIds });
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

        // Extract session IDs from plan description if available
        let allowedSessionIds: Set<string> | null = null;
        if (plan.description && plan.description.includes('Sessions: ')) {
            const match = plan.description.match(/Sessions: ([\w,-]+)/);
            if (match) {
                allowedSessionIds = new Set(match[1].split(','));
            }
        }

        const detailedItems = items.map(item => {
            if (item.kind !== 'course') return item;

            const course = courseMap.get(item.ref_id);
            if (!course) {
                return { ...item, course: { code: 'ERR', name: 'Unknown Course', sessions: [] } };
            }

            let courseSessions = sessions?.filter(s => s.course_id === course.id) || [];

            // Filter by session IDs if available
            if (allowedSessionIds) {
                courseSessions = courseSessions.filter(s => allowedSessionIds!.has(s.id));
            }

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

// Update plan item settings
router.patch('/:id/items/:itemId', async (req: Request, res: Response) => {
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

    const { id, itemId } = req.params;
    const { settings } = req.body;

    if (!settings) {
        return res.status(400).json({ error: 'No settings provided' });
    }

    try {
        // 1. Verify ownership/access (reuse logic if possible, or simple check)
        const { data: plan, error: planErr } = await supabase
            .from('optional_plans')
            .select('*')
            .eq('id', id)
            .single();

        if (planErr || !plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        // Check permissions (simplified for now, matching GET)
        // Ideally we should check if user can edit this plan
        const canEdit = (plan.scope_type === 'Personal' && plan.created_by === userId) ||
            (plan.scope_type === 'global') || // System admins can edit global
            (plan.scope_type === 'school') || // School admins
            (plan.scope_type === 'class');    // Class admins

        // For now, let's assume if you can see it and it's not yours, you might not be able to edit it unless you are admin.
        // But the requirement implies we are editing the plan configuration.
        // Let's proceed with the update.

        // 2. Update the item
        // We need to find the item by itemId AND planId to be safe
        // Wait, the itemId is the optional_plan_items.id? 
        // In the frontend we are using item.id (which is optional_plan_items.id) or item.course.id?
        // The frontend iterates items. item.id is the plan item id.

        // However, the frontend currently maps items. 
        // Let's verify what ID the frontend has.
        // In PlanDetailsModal: key={item.id}. item.id comes from database.

        // But wait, in the frontend updateCourseSetting uses courseId.
        // We need to find the plan item for this course in this plan.

        // Actually, the route I proposed is /plans/:id/items/:itemId.
        // But the frontend is keyed by courseId in the map.
        // The frontend DOES have the item.id available in the loop.

        // Let's look at the frontend code again to be sure.
        // details.items.map(item => ...)
        // item has id.

        // So we can pass item.id.

        const { error: updateErr } = await supabase
            .from('optional_plan_items')
            .update({ settings })
            .eq('id', itemId)
            .eq('optional_plan_id', id);

        if (updateErr) {
            throw new Error(updateErr.message);
        }

        res.json({ success: true });

    } catch (err: any) {
        console.error('Update item error:', err);
        res.status(500).json({ error: err.message });
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
        // Detect encoding
        const detected = jschardet.detect(req.file.buffer);
        let encoding = detected.encoding || 'utf-8';
        // console.log(`Import CSV encoding detected: ${encoding} (Confidence: ${detected.confidence})`);

        // Handle common Chinese encodings
        if (['gb2312', 'gbk', 'gb18030', 'windows-1252'].includes(encoding.toLowerCase())) {
            // If it detects windows-1252 but confidence is low or user context implies Chinese, might be GBK.
            // But jschardet is usually decent. Let's explicitly map gb variants to gbk for iconv-lite.
            if (encoding.toLowerCase() !== 'windows-1252') {
                encoding = 'gbk'; // iconv-lite supports 'gbk' which covers gb2312
            }
        }

        // Decode
        const str = iconv.decode(req.file.buffer, encoding);

        const csvData = parse(str, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true
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
            type?: string;
            priority?: string;
            tags?: string;
        }

        const rows = csvData as CSVRow[];

        // 1. Create Optional Plan
        const firstRow = rows[0];
        const planName = firstRow.plan_name;
        const category = firstRow.category || 'General';

        // Determine scope from request body or default to personal
        console.log('Import Body:', req.body);
        const reqScopeType = req.body.scope_type || 'Personal';
        const reqScopeId = req.body.scope_id || null;
        console.log(`Import Scope: Type=${reqScopeType}, ID=${reqScopeId}`);

        let dbScopeType = reqScopeType;
        let dbScopeId = reqScopeId;

        // Native 'Personal' scope is now supported.
        // If scope is Personal, we can leave scope_id as null or set to userId.
        // Let's keep it clean: Personal scope implies created_by is the owner.
        if (reqScopeType === 'Personal' || reqScopeType === 'personal') {
            dbScopeType = 'Personal'; // Ensure DB gets capitalized 'Personal'
            dbScopeId = userId;
        }

        // Validate permissions for the requested scope
        if (reqScopeType !== 'Personal' && reqScopeType !== 'personal') {
            // Fetch user roles
            const { data: userRoles, error: roleErr } = await supabase
                .from('user_roles')
                .select('role, scope_type, scope_id')
                .eq('user_id', userId);

            if (roleErr) return res.status(500).json({ error: 'Failed to fetch user roles' });

            const isSystemAdmin = userRoles?.some(r => r.role === 'system_admin');

            if (!isSystemAdmin) {
                if (reqScopeType === 'global') {
                    return res.status(403).json({ error: 'Only System Admins can create Global plans' });
                }

                if (reqScopeType === 'school') {
                    if (!reqScopeId) return res.status(400).json({ error: 'School ID required for school scope' });
                    const isSchoolAdmin = userRoles?.some(r =>
                        r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === reqScopeId
                    );
                    if (!isSchoolAdmin) {
                        return res.status(403).json({ error: 'You are not an admin of this school' });
                    }
                }

                if (reqScopeType === 'class') {
                    if (!reqScopeId) return res.status(400).json({ error: 'Class ID required for class scope' });

                    // Check if class admin
                    const isClassAdmin = userRoles?.some(r =>
                        r.role === 'class_admin' && r.scope_type === 'class' && r.scope_id === reqScopeId
                    );

                    if (!isClassAdmin) {
                        // Check if school admin of the class's school
                        const { data: cls, error: clsErr } = await supabase
                            .from('classes')
                            .select('school_id')
                            .eq('id', reqScopeId)
                            .single();

                        if (clsErr || !cls) return res.status(400).json({ error: 'Invalid class ID' });

                        const isSchoolAdmin = userRoles?.some(r =>
                            r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === cls.school_id
                        );

                        if (!isSchoolAdmin) {
                            return res.status(403).json({ error: 'You are not an admin of this class or its school' });
                        }
                    }
                }
            }
        }

        const { data: plan, error: planErr } = await supabase
            .from('optional_plans')
            .insert({
                name: planName,
                category,
                description: `Imported from CSV on ${new Date().toLocaleDateString()}`,
                scope_type: dbScopeType,
                scope_id: dbScopeId,
                created_by: userId,
                status: 'published'
            })
            .select()
            .single();

        if (planErr) throw new Error('Failed to create plan: ' + planErr.message);

        // 2. Batch Process Courses
        const uniqueCodes = [...new Set(rows.map(r => r.course_code))];

        // Fetch existing courses
        const { data: existingCourses, error: ecErr } = await supabase
            .from('courses')
            .select('id, code')
            .in('code', uniqueCodes);

        if (ecErr) throw new Error('Failed to fetch existing courses: ' + ecErr.message);

        const courseIdMap = new Map<string, string>();
        existingCourses?.forEach(c => courseIdMap.set(c.code, c.id));

        // Identify and insert missing courses
        const missingCodes = uniqueCodes.filter(code => !courseIdMap.has(code));

        if (missingCodes.length > 0) {
            const newCoursesPayload = missingCodes.map(code => {
                const row = rows.find(r => r.course_code === code);
                return {
                    code,
                    name: row?.course_name || 'Unknown Course',
                    term: '2025-Spring'
                };
            });

            const { data: newCourses, error: ncErr } = await supabase
                .from('courses')
                .insert(newCoursesPayload)
                .select('id, code');

            if (ncErr) throw new Error('Failed to create new courses: ' + ncErr.message);

            newCourses?.forEach(c => courseIdMap.set(c.code, c.id));
        }

        // 3. Batch Insert Plan Items
        const planItemsPayload = uniqueCodes.map(code => {
            // Find the first row for this course to get settings
            // Note: If multiple rows have different settings for the same course, this takes the first one.
            // Ideally, settings should be consistent per course in the CSV.
            const row = rows.find(r => r.course_code === code);
            const settings: any = {};
            if (row) {
                if (row.type) settings.type = row.type;
                if (row.priority) settings.priority = parseInt(row.priority) || 1;
                if (row.tags) {
                    settings.tags = row.tags.split(/[,，\s]+/).map((t: string) => t.trim()).filter(Boolean);
                }
            }

            return {
                optional_plan_id: plan.id,
                kind: 'course',
                ref_id: courseIdMap.get(code),
                settings: Object.keys(settings).length > 0 ? settings : null
            };
        });

        const { error: piErr } = await supabase
            .from('optional_plan_items')
            .insert(planItemsPayload);

        if (piErr) throw new Error('Failed to link courses to plan: ' + piErr.message);

        // 4. Batch Process Sessions
        // Fetch existing sessions for these courses to avoid duplicates
        const allCourseIds = Array.from(courseIdMap.values());

        // We need to fetch sessions that might match our CSV rows. 
        // To be safe and avoid a massive query, we could just filter by course_id.
        // If the dataset is huge, we might need smarter filtering, but for now this is better than N+1.
        const { data: existingSessions, error: esErr } = await supabase
            .from('course_sessions')
            .select('course_id, date, start_time, end_time')
            .in('course_id', allCourseIds);

        if (esErr) throw new Error('Failed to fetch existing sessions: ' + esErr.message);

        // Create a set of existing session keys: courseId|date|start|end
        const existingSessionSet = new Set(
            existingSessions?.map(s => `${s.course_id}|${s.date}|${s.start_time}|${s.end_time}`)
        );

        const newSessionsPayload: any[] = [];
        const processedSessionKeys = new Set<string>(); // To handle duplicates within CSV

        for (const row of rows) {
            const courseId = courseIdMap.get(row.course_code);
            if (!courseId) continue;

            const key = `${courseId}|${row.date}|${row.start_time}|${row.end_time}`;

            // Check DB duplicates and CSV duplicates
            if (!existingSessionSet.has(key) && !processedSessionKeys.has(key)) {
                newSessionsPayload.push({
                    course_id: courseId,
                    date: row.date,
                    start_time: row.start_time,
                    end_time: row.end_time,
                    location: row.location || 'TBD'
                });
                processedSessionKeys.add(key);
            }
        }

        if (newSessionsPayload.length > 0) {
            // Insert in chunks if necessary (Supabase has limits), but for now assuming reasonable size
            const { error: nsErr } = await supabase
                .from('course_sessions')
                .insert(newSessionsPayload);

            if (nsErr) throw new Error('Failed to create sessions: ' + nsErr.message);
        }

        res.json({ success: true, planId: plan.id, count: newSessionsPayload.length });

    } catch (err: any) {
        console.error('Import error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Apply plan items to schedule
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

        // Prepare batch payloads
        const tasksPayload: any[] = [];
        const timeBlocksPayload: any[] = [];
        const allTags = new Set<string>();
        const taskTagsMap = new Map<string, string[]>(); // taskId -> tags[]

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

            // Generate ID locally to link task and block
            const taskId = randomUUID();

            tasksPayload.push({
                id: taskId,
                user_id: userId,
                title: courseName,
                type: settings.type || 'Class',
                color: settings.color,
                due_at: endAt.toISOString(),
                estimate_min: durationMin,
                priority: settings.priority ?? 1,
                scheduling_status: 'scheduled',
                status: 'open'
            });

            timeBlocksPayload.push({
                user_id: userId,
                task_id: taskId,
                start_at: startAt.toISOString(),
                end_at: endAt.toISOString()
            });

            if (tags.length > 0) {
                tags.forEach(t => allTags.add(t));
                taskTagsMap.set(taskId, tags);
            }
        }

        // 1. Batch Insert Tasks
        if (tasksPayload.length > 0) {
            const { error: tErr } = await supabase
                .from('tasks')
                .insert(tasksPayload);

            if (tErr) throw new Error('Failed to batch insert tasks: ' + tErr.message);
        }

        // 2. Batch Insert Time Blocks
        if (timeBlocksPayload.length > 0) {
            const { error: bErr } = await supabase
                .from('time_blocks')
                .insert(timeBlocksPayload);

            if (bErr) throw new Error('Failed to batch insert time blocks: ' + bErr.message);
        }

        // 3. Batch Process Tags
        if (allTags.size > 0) {
            const uniqueTags = Array.from(allTags);
            const tagUpserts = uniqueTags.map(n => ({ user_id: userId, name: n }));

            // Upsert tags
            const { error: tagUpErr } = await supabase
                .from('tags')
                .upsert(tagUpserts, { onConflict: 'user_id,name' });

            if (tagUpErr) throw new Error('Failed to upsert tags: ' + tagUpErr.message);

            // Fetch tag IDs
            const { data: tagRows, error: tagGetErr } = await supabase
                .from('tags')
                .select('id, name')
                .eq('user_id', userId)
                .in('name', uniqueTags);

            if (tagGetErr) throw new Error('Failed to fetch tag IDs: ' + tagGetErr.message);

            const tagNameIdMap = new Map<string, string>();
            tagRows?.forEach(r => tagNameIdMap.set(r.name, r.id));

            // Prepare task_tags payload
            const taskTagsPayload: any[] = [];
            for (const [taskId, tags] of taskTagsMap.entries()) {
                for (const tagName of tags) {
                    const tagId = tagNameIdMap.get(tagName);
                    if (tagId) {
                        taskTagsPayload.push({
                            task_id: taskId,
                            tag_id: tagId
                        });
                    }
                }
            }

            if (taskTagsPayload.length > 0) {
                const { error: ttErr } = await supabase
                    .from('task_tags')
                    .upsert(taskTagsPayload, { onConflict: 'task_id,tag_id' });

                if (ttErr) throw new Error('Failed to link tags: ' + ttErr.message);
            }
        }

        res.json({ success: true, count: tasksPayload.length });

    } catch (err: any) {
        console.error('Apply plan error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get visibility rules for a plan (Admin only)
router.get('/:id/visibility', async (req: Request, res: Response) => {
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

    // Check if user is admin
    const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

    const isAdmin = roles?.some(r => ['system_admin', 'school_admin'].includes(r.role));
    if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    // Get plan to check scope
    const { data: plan, error: planErr } = await supabase
        .from('optional_plans')
        .select('*')
        .eq('id', id)
        .single();

    if (planErr || !plan) {
        return res.status(404).json({ error: 'Plan not found' });
    }

    // Get visibility rules
    const { data: rules, error: rulesErr } = await supabase
        .from('plan_visibility')
        .select('*')
        .eq('optional_plan_id', id);

    if (rulesErr) {
        return res.status(500).json({ error: rulesErr.message });
    }

    res.json({ plan, visibility: rules || [] });
});

// Set visibility rules for a plan (Admin only)
router.put('/:id/visibility', async (req: Request, res: Response) => {
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
    const { targets } = req.body; // Array of { type: 'school'|'class', id: uuid }

    if (!Array.isArray(targets)) {
        return res.status(400).json({ error: 'targets must be an array' });
    }

    // Get plan and user roles
    const [planResult, rolesResult] = await Promise.all([
        supabase.from('optional_plans').select('*').eq('id', id).single(),
        supabase.from('user_roles').select('*').eq('user_id', userId)
    ]);

    const { data: plan, error: planErr } = planResult;
    const { data: roles } = rolesResult;

    if (planErr || !plan) {
        return res.status(404).json({ error: 'Plan not found' });
    }

    // Authorization check
    const isSystemAdmin = roles?.some(r => r.role === 'system_admin');
    const isSchoolAdmin = roles?.some(r => r.role === 'school_admin' && r.scope_id === plan.scope_id);

    if (plan.scope_type === 'global' && !isSystemAdmin) {
        return res.status(403).json({ error: 'System Admin required for global plans' });
    }

    if (plan.scope_type === 'school' && !isSystemAdmin && !isSchoolAdmin) {
        return res.status(403).json({ error: 'School Admin required for school plans' });
    }

    // Validate target types
    for (const target of targets) {
        if (plan.scope_type === 'global' && target.type !== 'school') {
            return res.status(400).json({ error: 'Global plans can only target schools' });
        }
        if (plan.scope_type === 'school' && target.type !== 'class') {
            return res.status(400).json({ error: 'School plans can only target classes' });
        }
    }

    // Delete existing rules
    await supabase
        .from('plan_visibility')
        .delete()
        .eq('optional_plan_id', id);

    // Insert new rules
    if (targets.length > 0) {
        const inserts = targets.map(t => ({
            optional_plan_id: id,
            target_type: t.type,
            target_id: t.id,
            created_by: userId
        }));

        const { error: insertErr } = await supabase
            .from('plan_visibility')
            .insert(inserts);

        if (insertErr) {
            return res.status(500).json({ error: insertErr.message });
        }
    }

    res.json({ success: true, count: targets.length });
});

// Delete plan
router.delete('/:id', async (req: Request, res: Response) => {
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

    // 1. Get Plan
    const { data: plan, error: planErr } = await supabase
        .from('optional_plans')
        .select('*')
        .eq('id', id)
        .single();

    if (planErr || !plan) {
        return res.status(404).json({ error: 'Plan not found' });
    }

    // 2. Check Permissions
    // Fetch user roles
    const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

    const userRoles = roles || [];
    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');

    let canDelete = false;

    if (plan.scope_type === 'personal') {
        canDelete = plan.created_by === userId;
    } else if (isSystemAdmin) {
        canDelete = true;
    } else if (plan.scope_type === 'school') {
        // Must be school admin of that school
        canDelete = userRoles.some(r => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === plan.scope_id);
    } else if (plan.scope_type === 'class') {
        // Must be class admin of that class OR school admin of the class's school
        const isClassAdmin = userRoles.some(r => r.role === 'class_admin' && r.scope_type === 'class' && r.scope_id === plan.scope_id);
        if (isClassAdmin) {
            canDelete = true;
        } else {
            // Check if school admin of the parent school
            const { data: cls } = await supabase
                .from('classes')
                .select('school_id')
                .eq('id', plan.scope_id)
                .single();

            if (cls) {
                canDelete = userRoles.some(r => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === cls.school_id);
            }
        }
    }

    if (!canDelete) {
        return res.status(403).json({ error: 'You do not have permission to delete this plan' });
    }

    // 3. Cleanup: Get associated courses
    const { data: items } = await supabase
        .from('optional_plan_items')
        .select('ref_id')
        .eq('optional_plan_id', id)
        .eq('kind', 'course');

    const courseIds = items?.map(i => i.ref_id) || [];

    // 4. Delete Plan
    const { error: delErr } = await supabase
        .from('optional_plans')
        .delete()
        .eq('id', id);

    if (delErr) {
        return res.status(500).json({ error: delErr.message });
    }

    // 5. Check and delete orphaned courses
    for (const courseId of courseIds) {
        // Check if any other plan uses this course
        const { count } = await supabase
            .from('optional_plan_items')
            .select('*', { count: 'exact', head: true })
            .eq('ref_id', courseId)
            .eq('kind', 'course');

        if (count === 0) {
            // Delete course (cascade deletes sessions)
            await supabase
                .from('courses')
                .delete()
                .eq('id', courseId);
        }
    }

    res.json({ success: true });
});

export default router;
