-- Supabase Initial Schema (DDL)
-- Assumes custom JWT with claim user_id for RLS; helper functions in schema app/

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS app;

-- JWT helper: access request.jwt.claims safely
CREATE OR REPLACE FUNCTION app.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
$$;

-- Current application user id (from custom claim user_id)
CREATE OR REPLACE FUNCTION app.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(app.jwt()->>'user_id','')::uuid;
$$;

-- Enumerations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE app.role AS ENUM ('system_admin','school_admin','class_admin','student');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scope_type') THEN
    CREATE TYPE app.scope_type AS ENUM ('system','school','class');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'join_status') THEN
    CREATE TYPE app.join_status AS ENUM ('pending','approved','rejected');
  END IF;
END $$;

-- Core tables
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  nickname text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role app.role NOT NULL,
  scope_type app.scope_type NOT NULL,
  scope_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  join_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status app.join_status NOT NULL DEFAULT 'pending',
  note text,
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cjr_pending ON class_join_requests(user_id, class_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS class_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, class_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text,
  color text,
  due_at timestamptz,
  estimate_min int,
  priority int,
  recurrence_rule text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  scheduling_status text NOT NULL DEFAULT 'unscheduled' CHECK (scheduling_status IN ('scheduled','unscheduled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  recurrence_rule text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  term text NOT NULL,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  instructor text,
  attendance_policy text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS optional_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type app.scope_type NOT NULL,
  scope_id uuid,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published'))
);

CREATE TABLE IF NOT EXISTS optional_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  optional_plan_id uuid NOT NULL REFERENCES optional_plans(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('course','session','task')),
  ref_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS selected_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  optional_plan_id uuid NOT NULL REFERENCES optional_plans(id),
  effective_from date,
  UNIQUE(class_id)
);

CREATE TABLE IF NOT EXISTS shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  scope text NOT NULL CHECK (scope IN ('blocks_only','full')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type app.scope_type NOT NULL,
  scope_id uuid,
  daily_summary_time time NOT NULL DEFAULT TIME '04:00',
  timezone text NOT NULL DEFAULT 'Asia/Shanghai',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_summary_time time,
  timezone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

COMMIT;
