import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
// Middleware to get user info
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization header' });
    }
    const token = authHeader.slice(7);
    let userId;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
    }
    catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
    req.userId = userId;
    next();
}
// List plans visible to user
router.get('/', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.slice(7);
    let userId;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
    }
    catch {
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
    if (planError)
        return res.status(500).json({ error: planError.message });
    // Fetch plan visibility rules
    const { data: visibilityRules } = await supabase
        .from('plan_visibility')
        .select('*');
    const visibilityMap = new Map();
    (visibilityRules || []).forEach((rule) => {
        if (!visibilityMap.has(rule.optional_plan_id)) {
            visibilityMap.set(rule.optional_plan_id, new Set());
        }
        visibilityMap.get(rule.optional_plan_id).add(`${rule.target_type}:${rule.target_id}`);
    });
    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');
    const schoolAdminSchoolIds = userRoles
        .filter(r => r.role === 'school_admin' && r.scope_type === 'school')
        .map(r => r.scope_id);
    const visiblePlans = plans.filter(p => {
        // Personal plans: only visible to creator
        if (p.scope_type === 'personal') {
            return p.created_by === userId;
        }
        // Check if there are visibility rules for this plan
        const rules = visibilityMap.get(p.id);
        if (p.scope_type === 'global') {
            // System admins always see global plans
            if (isSystemAdmin)
                return true;
            // If no rules, visible to all (default behavior)
            if (!rules || rules.size === 0)
                return true;
            // Check if user's schools are in allowed list
            for (const schoolId of schoolIds) {
                if (rules.has(`school:${schoolId}`))
                    return true;
            }
            return false;
        }
        if (p.scope_type === 'school') {
            // User must be in the school (or be a system admin? No, usually school plans are strictly scoped)
            // But let's stick to the requirement: School Admins for this school see it.
            // If user is school admin for this school, they see it regardless of class visibility
            if (schoolAdminSchoolIds.includes(p.scope_id))
                return true;
            // User must be in the school to see it at all (if not admin)
            if (!schoolIds.includes(p.scope_id))
                return false;
            // If no rules, visible to all school members (default)
            if (!rules || rules.size === 0)
                return true;
            // Check if user's classes are in allowed list
            for (const classId of allClassIds) {
                if (rules.has(`class:${classId}`))
                    return true;
            }
            return false;
        }
        if (p.scope_type === 'class') {
            // User must be in the class
            return allClassIds.includes(p.scope_id);
        }
        return false;
    });
    res.json({ plans: visiblePlans });
});
// Get plan details
router.get('/:id', async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /plans/${req.params.id} request received`);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No auth header');
        return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.slice(7);
    let userId;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
    }
    catch (e) {
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
        let allowedSessionIds = null;
        if (plan.description && plan.description.includes('Sessions: ')) {
            const match = plan.description.match(/Sessions: ([\w,-]+)/);
            if (match) {
                allowedSessionIds = new Set(match[1].split(','));
            }
        }
        const detailedItems = items.map(item => {
            if (item.kind !== 'course')
                return item;
            const course = courseMap.get(item.ref_id);
            if (!course) {
                return { ...item, course: { code: 'ERR', name: 'Unknown Course', sessions: [] } };
            }
            let courseSessions = sessions?.filter(s => s.course_id === course.id) || [];
            // Filter by session IDs if available
            if (allowedSessionIds) {
                courseSessions = courseSessions.filter(s => allowedSessionIds.has(s.id));
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
    }
    else {
        res.json({ plan, items: [] });
    }
});
// Import CSV
router.post('/import', upload.single('file'), async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('Import: No auth header');
        return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.slice(7);
    let userId;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
    }
    catch (err) {
        console.error('Import: JWT verification failed', err);
        return res.status(401).json({ error: 'Invalid token' });
    }
    if (!req.file)
        return res.status(400).json({ error: 'No file uploaded' });
    try {
        const csvData = parse(req.file.buffer.toString(), {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        if (csvData.length === 0)
            return res.status(400).json({ error: 'Empty CSV' });
        // Validate required columns
        const requiredCols = ['plan_name', 'category', 'course_code', 'course_name', 'date', 'start_time', 'end_time'];
        const headers = Object.keys(csvData[0]);
        const missing = requiredCols.filter(c => !headers.includes(c));
        if (missing.length > 0)
            return res.status(400).json({ error: `Missing columns: ${missing.join(', ')}` });
        const rows = csvData;
        // 1. Create Optional Plan
        const firstRow = rows[0];
        const planName = firstRow.plan_name;
        const category = firstRow.category || 'General';
        // Determine scope from request body or default to personal
        const scopeType = req.body.scope_type || 'personal';
        const scopeId = req.body.scope_id || null;
        // Validate permissions for the requested scope
        if (scopeType !== 'personal') {
            // Fetch user roles
            const { data: userRoles, error: roleErr } = await supabase
                .from('user_roles')
                .select('role, scope_type, scope_id')
                .eq('user_id', userId);
            if (roleErr)
                return res.status(500).json({ error: 'Failed to fetch user roles' });
            const isSystemAdmin = userRoles?.some(r => r.role === 'system_admin');
            if (!isSystemAdmin) {
                if (scopeType === 'global') {
                    return res.status(403).json({ error: 'Only System Admins can create Global plans' });
                }
                if (scopeType === 'school') {
                    if (!scopeId)
                        return res.status(400).json({ error: 'School ID required for school scope' });
                    const isSchoolAdmin = userRoles?.some(r => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === scopeId);
                    if (!isSchoolAdmin) {
                        return res.status(403).json({ error: 'You are not an admin of this school' });
                    }
                }
                if (scopeType === 'class') {
                    if (!scopeId)
                        return res.status(400).json({ error: 'Class ID required for class scope' });
                    // Check if class admin
                    const isClassAdmin = userRoles?.some(r => r.role === 'class_admin' && r.scope_type === 'class' && r.scope_id === scopeId);
                    if (!isClassAdmin) {
                        // Check if school admin of the class's school
                        const { data: cls, error: clsErr } = await supabase
                            .from('classes')
                            .select('school_id')
                            .eq('id', scopeId)
                            .single();
                        if (clsErr || !cls)
                            return res.status(400).json({ error: 'Invalid class ID' });
                        const isSchoolAdmin = userRoles?.some(r => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === cls.school_id);
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
            scope_type: scopeType,
            scope_id: scopeId,
            created_by: userId,
            status: 'published'
        })
            .select()
            .single();
        if (planErr)
            throw new Error('Failed to create plan: ' + planErr.message);
        // 2. Process rows
        const processedCourses = new Map(); // code -> id
        const sessionIds = [];
        const importStartTime = new Date().toISOString();
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
                }
                else {
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
                    if (cErr)
                        throw new Error('Failed to create course: ' + cErr.message);
                    courseId = newCourse.id;
                }
                processedCourses.set(row.course_code, courseId);
                // Link course to plan
                await supabase.from('optional_plan_items').insert({
                    optional_plan_id: plan.id,
                    kind: 'course',
                    ref_id: courseId
                });
            }
            // Create session and track its ID
            const { data: newSession, error: sErr } = await supabase
                .from('course_sessions')
                .insert({
                course_id: courseId,
                date: row.date,
                start_time: row.start_time,
                end_time: row.end_time,
                location: row.location || 'TBD'
            })
                .select('id')
                .single();
            if (sErr) {
                console.error('Failed to create session:', sErr);
            }
            else if (newSession) {
                sessionIds.push(newSession.id);
            }
        }
        // Store session IDs in plan metadata or description
        await supabase
            .from('optional_plans')
            .update({
            description: `Imported from CSV on ${new Date().toLocaleDateString()}. Sessions: ${sessionIds.join(',')}`
        })
            .eq('id', plan.id);
        res.json({ success: true, planId: plan.id });
    }
    catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ error: err.message });
    }
});
// Apply plan items to schedule
router.post('/:id/apply', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.slice(7);
    let userId;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
    }
    catch {
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
        const courseIds = courses.map((c) => c.courseId);
        // Get Sessions for all courses
        const { data: sessions, error: sessErr } = await supabase
            .from('course_sessions')
            .select('*, course:courses(code, name)')
            .in('course_id', courseIds);
        if (sessErr)
            throw new Error(sessErr.message);
        if (!sessions || sessions.length === 0) {
            return res.json({ success: true, count: 0, message: 'No sessions found for selected courses' });
        }
        // Build a map of courseId -> settings
        const settingsMap = new Map();
        courses.forEach((c) => {
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
            const courseCode = session.course?.code || '';
            const courseName = session.course?.name || 'Unknown Course';
            const tags = [...(settings.tags || [])];
            if (courseCode && !tags.includes(courseCode))
                tags.push(courseCode);
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
    }
    catch (err) {
        console.error('Apply plan error:', err);
        res.status(500).json({ error: err.message });
    }
});
// Get visibility rules for a plan (Admin only)
router.get('/:id/visibility', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.slice(7);
    let userId;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
    }
    catch {
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
router.put('/:id/visibility', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.slice(7);
    let userId;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
    }
    catch {
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
router.delete('/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.slice(7);
    let userId;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub;
    }
    catch {
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
    }
    else if (isSystemAdmin) {
        canDelete = true;
    }
    else if (plan.scope_type === 'school') {
        // Must be school admin of that school
        canDelete = userRoles.some(r => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === plan.scope_id);
    }
    else if (plan.scope_type === 'class') {
        // Must be class admin of that class OR school admin of the class's school
        const isClassAdmin = userRoles.some(r => r.role === 'class_admin' && r.scope_type === 'class' && r.scope_id === plan.scope_id);
        if (isClassAdmin) {
            canDelete = true;
        }
        else {
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
    // 3. Delete
    const { error: delErr } = await supabase
        .from('optional_plans')
        .delete()
        .eq('id', id);
    if (delErr) {
        return res.status(500).json({ error: delErr.message });
    }
    res.json({ success: true });
});
export default router;
