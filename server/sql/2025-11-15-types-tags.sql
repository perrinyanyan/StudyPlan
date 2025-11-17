-- Task Types, Tags, and Task-Tag relation
-- Safe to run multiple times

create table if not exists public.task_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, tag_id)
);

-- Ensure tasks table has priority 0/1/2
alter table public.tasks add column if not exists priority int;
alter table public.tasks add constraint tasks_priority_check check (priority in (0,1,2)) not valid;
alter table public.tasks validate constraint tasks_priority_check;

-- Optional helpful indexes
create index if not exists idx_task_types_user on public.task_types(user_id);
create index if not exists idx_tags_user on public.tags(user_id);
create index if not exists idx_task_tags_task on public.task_tags(task_id);
create index if not exists idx_task_tags_tag on public.task_tags(tag_id);
