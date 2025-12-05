import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db/supabase.js';
const router = Router();
router.use((_req, res, next) => {
    if (process.env.NODE_ENV === 'production')
        return res.status(404).end();
    next();
});
const bootstrapSchema = z.object({
    admin_email: z.string().email(),
    school_name: z.string().min(1),
    class_name: z.string().min(1),
    join_code: z.string().min(3),
});
router.post('/bootstrap-class', async (req, res) => {
    const parsed = bootstrapSchema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid input' });
    const { admin_email, school_name, class_name, join_code } = parsed.data;
    const { data: user, error: uErr } = await supabase
        .from('users')
        .select('id')
        .eq('email', admin_email)
        .maybeSingle();
    if (uErr || !user)
        return res.status(400).json({ error: 'AdminUserNotFound' });
    let schoolId;
    {
        const { data: sch, error: sErr } = await supabase
            .from('schools')
            .insert({ name: school_name })
            .select('id')
            .single();
        if (sErr || !sch)
            return res.status(500).json({ error: 'FailedToCreateSchool' });
        schoolId = sch.id;
    }
    let classId;
    {
        const { data: cls, error: cErr } = await supabase
            .from('classes')
            .insert({ school_id: schoolId, name: class_name, join_code })
            .select('id')
            .single();
        if (cErr || !cls)
            return res.status(500).json({ error: 'FailedToCreateClass' });
        classId = cls.id;
    }
    {
        const { error: rErr } = await supabase
            .from('user_roles')
            .insert({ user_id: user.id, role: 'class_admin', scope_type: 'class', scope_id: classId });
        if (rErr)
            return res.status(500).json({ error: 'FailedToAssignRole' });
    }
    res.status(201).json({ school_id: schoolId, class_id: classId });
});
export default router;
