## Context
- Audience: Grade 11 students using ACCP mode with ACCP & TOEFL online courses; needs homework/preview/review management and badminton exercise.
- Stakeholders: Student, Class Admin, School Admin, System Admin.
- Constraints: Desktop/mobile access (PWA), Mainland China accessibility, email verification, Web Push, multi-tenant roles (system/school/class), CSV/Excel import (one row per session), non-realtime sharing.

## Goals / Non-Goals
- Goals:
  - MVP study planner with tasks, planner, focus timer, notifications, and basic sharing.
  - Accounts with email verification and password reset; nickname editing with CAPTCHA.
  - Course schedule import (CSV/Excel; admin catalogs per term/class), adoption into plans.
  - Roles & authorization across system/school/class scopes.
  - PWA with offline cache and sync; domestic-first hosting and CDN.
- Non-Goals (MVP):
  - Realtime collaboration; third-party logins; native apps; payments; iCalendar import.

## Architecture Overview
- Frontend: Responsive PWA (React/Next.js or equivalent) with Service Worker (Workbox-like strategy), Web Push subscription UI, Focus (Wake Lock when supported).
- Backend: REST/JSON APIs with RBAC; background job worker for daily summary and reminders; push gateway for Web Push; email provider adapter.
- Data: Supabase Postgres (managed) as primary database (region: ap-southeast-1, Singapore); optional Supabase Storage for assets; CDN for static/app hosting.
- Deployment: Domestic-first for app hosting (Aliyun/Tencent/Huawei) with nationwide CDN; database on Supabase ap-southeast-1 (Singapore). Configure network egress/ingress and caching for stable Mainland access.

## Data Model (MVP)
- users(id, email, password_hash, email_verified_at, nickname, created_at)
- user_roles(id, user_id, role[system_admin|school_admin|class_admin|student], scope_type[system|school|class], scope_id, created_at)
- schools(id, name)
- classes(id, school_id, name, join_code, created_at)
- tasks(id, user_id, title, type, color, due_at, estimate_min, priority, recurrence_rule, status[open|done], scheduling_status[scheduled|unscheduled], created_at)
- time_blocks(id, user_id, task_id NULL, start_at, end_at, recurrence_rule NULL, created_at)
- courses(id, code, name, term, school_id NULL, created_at)
- course_sessions(id, course_id, date, start_time, end_time, location, class_id NULL)
- optional_plans(id, scope_type[global|school|class], scope_id, name, status[draft|published])
- optional_plan_items(id, optional_plan_id, kind[course|session|task], ref_id)
- selected_plans(id, class_id, optional_plan_id, effective_from)
- shares(id, owner_user_id, token, scope[blocks_only|full], expires_at, created_at)
- push_subscriptions(id, user_id, endpoint, p256dh, auth, user_agent, created_at)
- tenant_configs(id, scope_type[system|school|class], scope_id, daily_summary_time["HH:mm"], timezone, created_at)
- user_settings(id, user_id, daily_summary_time["HH:mm"], timezone NULL, created_at)  
  // Per-user overrides for notifications; user_settings.daily_summary_time takes precedence over tenant_configs

Notes:
- "scheduled" iff task has at least one time_block.
- Default timezone UTC+8; daily summary default 04:00 local per-tenant.

## Decisions
1) Hosting & Networking (Domestic-first)
- Choose a Mainland cloud (Aliyun/Tencent/Huawei) for primary app hosting and CDN. Use Supabase Postgres as the managed database in ap-southeast-1 (Singapore).
- Reason: latency and reliability in Mainland for app delivery; Supabase provides managed Postgres with developer ergonomics. Apply network optimizations between app and Supabase.

2) Authentication & Email
- Email/password auth with email verification before full access.
- Email provider is configurable; default emailjs.com via a backend adapter (never expose provider secrets in client). Preferred sender domain: qq.com. Verification/reset links signed and time-limited.
- Nickname change requires graphic numeric CAPTCHA (server generates challenge; verify server-side; rate limit).

3) Notifications & Web Push
- Use Web Push (VAPID) with Service Worker. Store subscriptions per user.
- Daily summary driven by a scheduled job that fires at tenant-configured local time (default 04:00) with per-user override taking precedence. Compute next-day or same-day unfinished tasks and deliver push notifications even when app is closed.
- Pre-block reminders: enqueue one-shot jobs per time block.

4) Roles & Authorization (RBAC)
- Hierarchical scopes: system → school → class. user_roles grants role within a scope.
- System Admin: manage admins across all scopes. School/Class Admins: publish optional/selected plans within their scope; manage catalogs and class membership.
- Enforcement via middleware checking (role, scope_type, scope_id) on each endpoint.

5) Course Schedules (CSV/Excel per Session) & Catalogs
- CSV/Excel import: enforce one-row-per-session with fields: course_code, course_name, term, class_code(optional), date(YYYY-MM-DD), start_time(HH:mm), end_time(HH:mm), location, instructor, attendance_policy.
- Admin-maintained catalogs (term/class). Selecting a course auto-populates all sessions.
- Validation: reject aggregated rows; dedupe by (course, date, time, class).

6) Planner & Tasks UX
- Planner: weekly/daily grid; drag from tasks to create blocks; conflict detection on save.
- Timeline: zoom in/out; auto-collapse when empty; current block highlighted with countdown.
- Unscheduled task pool with "Schedule" action to pick slot.
- Task ordering: scheduled tasks sorted by start time; unscheduled tasks in separate section.

7) Sharing
- Unguessable token (>=128-bit entropy, URL-safe). Default expiration 7 days; configurable per link.
- Share scope options: blocks_only (hide task titles/notes/labels) or full (include task details permitted by owner).
- Read-only rendering; viewers can "Copy to my plan" into own account.
- No early revoke or access logs in MVP (can be added later).

8) PWA & Offline
- Service Worker: cache-first for static, network-first with background sync for data (retry queue when offline).
- Focus: use Wake Lock API when available; fallback to keep-alive UI.

## Risks / Trade-offs
- Supabase connectivity from Mainland may vary; mitigate via region selection, connection pooling, edge proxies, and retries/backoff. Monitor latency; consider read caching if needed.
- Email deliverability via emailjs.com may vary; mitigate with verified sender/domain and DKIM/SPF. Provide adapter to swap providers if needed.
- Push delivery limitations on some platforms (e.g., iOS) and user permission rates. Provide graceful fallback (in-app reminders when online).
- Timezone & scheduling complexity for multi-tenant daily summary; rely on per-tenant timezone in tenant_configs.
- CSV data quality; provide downloadable template and server-side validation with good error messages.
- Domestic-first may limit some global services; keep abstractions for provider portability.

## Migration Plan
1. Accounts & Email (1.1)
2. Study Tasks core (1.2) + Enhancements (1.2.1)
3. Planner base + Timeline/Unscheduled/Current highlight (1.3)
4. Course Schedule import + catalogs; enforce one-row-per-session (1.4)
5. Focus timer (1.5)
6. Notifications (permission, pre-block, daily summary 04:00) + Web Push (1.6)
7. Sharing with default 7-day expiry and scope (1.7)
8. Multi-Device PWA + domestic-first hosting (1.8)
9. Roles & Authorization (1.9)
10. Classes (1.10)
11. Optional Plans (1.11)
12. Validation & hardening (2.1, 2.2)

## Open Questions
- Email sender domain subdomain usage (e.g., mail.qq.com vs custom subdomain) and DNS records (SPF/DKIM) rollout timeline?
