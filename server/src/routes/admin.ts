import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';

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

router.use(requireSystemAdmin);

// List all users with their roles
router.get('/users', async (req: Request, res: Response) => {
    // 1. Fetch all users
    const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id, email, nickname, created_at')
        .order('created_at', { ascending: false });

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

// Add role to user
const addRoleSchema = z.object({
    role: z.enum(['system_admin', 'school_admin', 'class_admin', 'student']),
    scope_type: z.enum(['global', 'school', 'class']).optional(),
    scope_id: z.string().optional()
});

router.post('/users/:id/roles', async (req: Request, res: Response) => {
    const userId = req.params.id;
    const validation = addRoleSchema.safeParse(req.body);

    if (!validation.success) {
        return res.status(400).json({ error: validation.error });
    }

    const { role, scope_type, scope_id } = validation.data;

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

// Remove role from user
router.delete('/users/:id/roles', async (req: Request, res: Response) => {
    const userId = req.params.id;
    const { role, scope_id } = req.body; // Expecting role and scope_id in body to identify which role to remove

    if (!role) return res.status(400).json({ error: 'Role is required' });

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

// List schools (for scope selection)
router.get('/schools', async (req: Request, res: Response) => {
    const { data, error } = await supabase.from('schools').select('id, name').order('name');
    if (error) return res.status(500).json({ error: 'Failed to fetch schools' });
    res.json({ schools: data });
});

// List classes (for scope selection)
router.get('/classes', async (req: Request, res: Response) => {
    const { data, error } = await supabase.from('classes').select('id, name, school_id').order('name');
    if (error) return res.status(500).json({ error: 'Failed to fetch classes' });
    res.json({ classes: data });
});

export default router;
