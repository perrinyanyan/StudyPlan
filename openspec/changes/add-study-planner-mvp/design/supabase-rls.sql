-- Supabase RLS Policies (Draft)
-- Uses auth.uid() for the current user. Helper role-check functions in schema app.

BEGIN;

-- Helper functions
CREATE OR REPLACE FUNCTION app.is_system_admin(uid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles r
    WHERE r.user_id = uid AND r.role = 'system_admin'
  );
$$;

CREATE OR REPLACE FUNCTION app.is_school_admin(uid uuid, sid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles r
    WHERE r.user_id = uid AND r.role = 'school_admin' AND r.scope_type = 'school' AND r.scope_id = sid
  ) OR app.is_system_admin(uid);
$$;

CREATE OR REPLACE FUNCTION app.is_class_admin(uid uuid, cid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles r
    WHERE r.user_id = uid AND r.role = 'class_admin' AND r.scope_type = 'class' AND r.scope_id = cid
  ) OR app.is_system_admin(uid);
$$;

CREATE OR REPLACE FUNCTION app.member_of_class(uid uuid, cid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_memberships m
    WHERE m.user_id = uid AND m.class_id = cid
  );
$$;

CREATE OR REPLACE FUNCTION app.member_of_school(uid uuid, sid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_memberships m
    JOIN classes c ON c.id = m.class_id
    WHERE m.user_id = uid AND c.school_id = sid
  );
$$;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE optional_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE optional_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- USERS: self only
CREATE POLICY users_select_self ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_update_self ON users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- USER_ROLES: user sees own roles; only system admin mutated
CREATE POLICY roles_select_self_or_sys ON user_roles FOR SELECT USING (user_id = auth.uid() OR app.is_system_admin(auth.uid()));
CREATE POLICY roles_mutate_sys_only ON user_roles FOR ALL USING (app.is_system_admin(auth.uid())) WITH CHECK (app.is_system_admin(auth.uid()));

-- SCHOOLS: readable to authenticated; mutated by system admin
CREATE POLICY schools_read ON schools FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY schools_mutate_sys ON schools FOR ALL USING (app.is_system_admin(auth.uid())) WITH CHECK (app.is_system_admin(auth.uid()));

-- CLASSES: read if member or admin
CREATE POLICY classes_read_members_or_admin ON classes FOR SELECT USING (
  app.is_system_admin(auth.uid()) OR app.member_of_school(auth.uid(), school_id)
);
-- Mutations: system or school admin of this school
CREATE POLICY classes_mutate_admin ON classes FOR ALL USING (app.is_school_admin(auth.uid(), school_id)) WITH CHECK (app.is_school_admin(auth.uid(), school_id));

-- CLASS_JOIN_REQUESTS
-- Select if owner, class admin, school admin of the class's school, or system admin
CREATE POLICY cjr_select ON class_join_requests FOR SELECT USING (
  user_id = auth.uid()
  OR app.is_class_admin(auth.uid(), class_id)
  OR EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND app.is_school_admin(auth.uid(), c.school_id))
  OR app.is_system_admin(auth.uid())
);
-- Insert: user creates own pending request
CREATE POLICY cjr_insert ON class_join_requests FOR INSERT WITH CHECK (user_id = auth.uid());
-- Update: only admins approve/reject
CREATE POLICY cjr_update_admin ON class_join_requests FOR UPDATE USING (
  app.is_class_admin(auth.uid(), class_id)
  OR EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND app.is_school_admin(auth.uid(), c.school_id))
  OR app.is_system_admin(auth.uid())
) WITH CHECK (
  app.is_class_admin(auth.uid(), class_id)
  OR EXISTS (SELECT 1 FROM classes c WHERE c.id = class_id AND app.is_school_admin(auth.uid(), c.school_id))
  OR app.is_system_admin(auth.uid())
);

-- CLASS_MEMBERSHIPS
-- Select: any member of the class or admins can see members; users can always see their own membership rows
CREATE POLICY cm_select ON class_memberships FOR SELECT USING (
  user_id = auth.uid()
  OR app.is_class_admin(auth.uid(), class_id)
  OR EXISTS (SELECT 1 FROM class_memberships m2 WHERE m2.class_id = class_id AND m2.user_id = auth.uid())
  OR app.is_system_admin(auth.uid())
);
-- Insert: only class/system admins
CREATE POLICY cm_insert_admin ON class_memberships FOR INSERT WITH CHECK (
  app.is_class_admin(auth.uid(), class_id) OR app.is_system_admin(auth.uid())
);
-- Delete: only class/system admins
CREATE POLICY cm_delete_admin ON class_memberships FOR DELETE USING (
  app.is_class_admin(auth.uid(), class_id) OR app.is_system_admin(auth.uid())
);

-- TASKS: owner-only CRUD
CREATE POLICY tasks_read_own ON tasks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY tasks_insert_own ON tasks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY tasks_update_own ON tasks FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY tasks_delete_own ON tasks FOR DELETE USING (user_id = auth.uid());

-- TIME_BLOCKS: owner-only CRUD
CREATE POLICY tb_read_own ON time_blocks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY tb_insert_own ON time_blocks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY tb_update_own ON time_blocks FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY tb_delete_own ON time_blocks FOR DELETE USING (user_id = auth.uid());

-- COURSES & SESSIONS: read for authenticated; write by admins
CREATE POLICY courses_read ON courses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY courses_write_admin ON courses FOR ALL USING (
  app.is_system_admin(auth.uid()) OR (school_id IS NOT NULL AND app.is_school_admin(auth.uid(), school_id))
) WITH CHECK (
  app.is_system_admin(auth.uid()) OR (school_id IS NOT NULL AND app.is_school_admin(auth.uid(), school_id))
);

CREATE POLICY cs_read ON course_sessions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY cs_write_admin ON course_sessions FOR ALL USING (
  app.is_system_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND (c.school_id IS NULL OR app.is_school_admin(auth.uid(), c.school_id)))
) WITH CHECK (
  app.is_system_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND (c.school_id IS NULL OR app.is_school_admin(auth.uid(), c.school_id)))
);

-- OPTIONAL PLANS (scope-aware)
CREATE POLICY op_select ON optional_plans FOR SELECT USING (
  app.is_system_admin(auth.uid())
  OR scope_type = 'global'
  OR (scope_type = 'school' AND app.member_of_school(auth.uid(), scope_id))
  OR (scope_type = 'class'  AND app.member_of_class(auth.uid(), scope_id))
);
CREATE POLICY op_write_admin ON optional_plans FOR ALL USING (
  app.is_system_admin(auth.uid())
  OR (scope_type = 'school' AND app.is_school_admin(auth.uid(), scope_id))
  OR (scope_type = 'class' AND app.is_class_admin(auth.uid(), scope_id))
) WITH CHECK (
  app.is_system_admin(auth.uid())
  OR (scope_type = 'school' AND app.is_school_admin(auth.uid(), scope_id))
  OR (scope_type = 'class' AND app.is_class_admin(auth.uid(), scope_id))
);

CREATE POLICY opi_select ON optional_plan_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM optional_plans p WHERE p.id = optional_plan_id AND (
    app.is_system_admin(auth.uid())
    OR p.scope_type = 'global'
    OR (p.scope_type = 'school' AND app.member_of_school(auth.uid(), p.scope_id))
    OR (p.scope_type = 'class'  AND app.member_of_class(auth.uid(), p.scope_id))
  ))
);
CREATE POLICY opi_write_admin ON optional_plan_items FOR ALL USING (
  EXISTS (SELECT 1 FROM optional_plans p WHERE p.id = optional_plan_id AND (
    app.is_system_admin(auth.uid())
    OR (p.scope_type = 'school' AND app.is_school_admin(auth.uid(), p.scope_id))
    OR (p.scope_type = 'class'  AND app.is_class_admin(auth.uid(), p.scope_id))
  ))
) WITH CHECK (
  EXISTS (SELECT 1 FROM optional_plans p WHERE p.id = optional_plan_id AND (
    app.is_system_admin(auth.uid())
    OR (p.scope_type = 'school' AND app.is_school_admin(auth.uid(), p.scope_id))
    OR (p.scope_type = 'class'  AND app.is_class_admin(auth.uid(), p.scope_id))
  ))
);

-- SELECTED PLANS
CREATE POLICY sp_select ON selected_plans FOR SELECT USING (
  app.is_system_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM class_memberships m WHERE m.class_id = selected_plans.class_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles r WHERE r.role = 'class_admin' AND r.scope_type = 'class' AND r.scope_id = selected_plans.class_id AND r.user_id = auth.uid())
);
CREATE POLICY sp_write_admin ON selected_plans FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles r WHERE r.role = 'class_admin' AND r.scope_type = 'class' AND r.scope_id = selected_plans.class_id AND r.user_id = auth.uid())
  OR app.is_system_admin(auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles r WHERE r.role = 'class_admin' AND r.scope_type = 'class' AND r.scope_id = selected_plans.class_id AND r.user_id = auth.uid())
  OR app.is_system_admin(auth.uid())
);

-- SHARES: owner-only; public access is mediated by server (service role)
CREATE POLICY shares_owner_read ON shares FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY shares_owner_write ON shares FOR ALL USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

-- PUSH SUBSCRIPTIONS: owner-only
CREATE POLICY push_read_own ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY push_write_own ON push_subscriptions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- TENANT CONFIGS: admins only
CREATE POLICY tc_read_admin ON tenant_configs FOR SELECT USING (
  app.is_system_admin(auth.uid())
  OR (scope_type = 'school' AND app.is_school_admin(auth.uid(), scope_id))
  OR (scope_type = 'class' AND app.is_class_admin(auth.uid(), scope_id))
);
CREATE POLICY tc_write_admin ON tenant_configs FOR ALL USING (
  app.is_system_admin(auth.uid())
  OR (scope_type = 'school' AND app.is_school_admin(auth.uid(), scope_id))
  OR (scope_type = 'class' AND app.is_class_admin(auth.uid(), scope_id))
) WITH CHECK (
  app.is_system_admin(auth.uid())
  OR (scope_type = 'school' AND app.is_school_admin(auth.uid(), scope_id))
  OR (scope_type = 'class' AND app.is_class_admin(auth.uid(), scope_id))
);

-- USER SETTINGS: owner-only
CREATE POLICY us_select_own ON user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY us_upsert_own ON user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY us_update_own ON user_settings FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMIT;
