# Notification Scheduling Design (Tenant/User Timezone & Time Overrides)

## Overview
Goal: deliver notifications (daily summary, pre-block reminders) honoring tenant-level defaults and per-user overrides for time and timezone.

- Data sources:
  - tenant_configs(scope_type, scope_id, daily_summary_time TIME, timezone TEXT)
  - user_settings(user_id, daily_summary_time TIME, timezone TEXT NULL)
  - time_blocks(start_at TIMESTAMPTZ, end_at TIMESTAMPTZ, user_id)
  - push_subscriptions(user_id, endpoint, p256dh, auth)

## Resolution Rules
- timezone := user_settings.timezone || tenant_configs.timezone || "Asia/Shanghai" (default UTC+8)
- summary_time := user_settings.daily_summary_time || tenant_configs.daily_summary_time || TIME '04:00'
- All scheduling uses IANA timezone computations; convert to UTC when enqueuing jobs.

## Pseudocode
```pseudo
function resolve_timezone(user_id, tenant):
  tz_user = select timezone from user_settings where user_id = $user_id
  if tz_user not null: return tz_user
  tz_tenant = select timezone from tenant_configs where scope = tenant.scope and scope_id = tenant.id
  if tz_tenant not null: return tz_tenant
  return "Asia/Shanghai"

function resolve_summary_time(user_id, tenant):
  t_user = select daily_summary_time from user_settings where user_id = $user_id
  if t_user not null: return t_user
  t_tenant = select daily_summary_time from tenant_configs where scope = tenant.scope and scope_id = tenant.id
  if t_tenant not null: return t_tenant
  return TIME '04:00'

function next_run_at_local(local_time: TIME, tz: IANA_TZ, from_now=now()):
  today_local = from_now in tz
  candidate = combine(date=today_local.date, time=local_time, tz)
  if candidate <= today_local: candidate = candidate + 1 day
  return to_utc(candidate)

// Daily summary planner (runs hourly or daily)
job plan_daily_summaries():
  for each active user u:
    tz = resolve_timezone(u.id, u.tenant)
    t  = resolve_summary_time(u.id, u.tenant)
    run_at = next_run_at_local(t, tz)
    enqueue_unique(queue="notifications:daily_summary", key="ds:"+u.id+":"+date(run_at, tz),
                   run_at=run_at, payload={user_id:u.id})

// Pre-block reminder planning (on block create/update/delete)
job on_time_block_changed(block):
  if block.deleted:
    cancel_future_jobs(queue="notifications:block_reminder", filter task_id=block.id)
    return
  lead = minutes_before_start = 5  // configurable later
  tz = resolve_timezone(block.user_id, block.tenant)
  start_local = convert(block.start_at, tz)
  remind_at_local = start_local - lead minutes
  if remind_at_local < now(tz): return // past
  run_at = to_utc(remind_at_local)
  enqueue_unique(queue="notifications:block_reminder", key="br:"+block.id,
                 run_at=run_at, payload={user_id:block.user_id, block_id:block.id})

// Delivery workers
worker deliver_daily_summary(msg):
  user_id = msg.user_id
  if not has_push_subscription(user_id): return
  tasks = query_unfinished_tasks(user_id, today(user_id.tz))
  push_notify(user_id, title="今日待办汇总", body=render(tasks))

worker deliver_block_reminder(msg):
  u = msg.user_id
  b = msg.block_id
  if not has_push_subscription(u): return
  push_notify(u, title="即将开始", body=render_block(b))
```

## Queue & Idempotency
- Queues: `notifications:daily_summary`, `notifications:block_reminder`.
- Unique keys per user/day and per block ensure no duplicates after rescheduling.
- On timezone/time changes (tenant or user), re-run planners and cancel outdated future jobs matching user scope.

## DST & Timezones
- Always use IANA time zones (e.g., Asia/Shanghai, Asia/Singapore).
- Compute `candidate` in local tz then convert to UTC; avoid storing naive local timestamps.

## Failure Handling
- Exponential backoff retries for transient failures.
- Drop messages after N attempts; surface metrics.

## Security
- Only send notifications if user granted permission and has active subscription.
- Allow users to opt-out of daily summary or reminders in settings (future).
