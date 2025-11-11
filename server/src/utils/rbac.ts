import { supabase } from '../db/supabase.js';

export async function isAdminOfClass(userId: string, classId: string): Promise<boolean> {
  const { data: roles, error: rErr } = await supabase
    .from('user_roles')
    .select('role, scope_type, scope_id')
    .eq('user_id', userId);
  if (rErr) return false;
  if (roles?.some(r => r.role === 'system_admin')) return true;
  if (roles?.some(r => r.role === 'class_admin' && r.scope_type === 'class' && r.scope_id === classId)) return true;
  const { data: cls, error: cErr } = await supabase
    .from('classes')
    .select('school_id')
    .eq('id', classId)
    .maybeSingle();
  if (cErr || !cls) return false;
  if (cls.school_id && roles?.some(r => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === cls.school_id)) return true;
  return false;
}

export async function isMemberOfClass(userId: string, classId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('class_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}
