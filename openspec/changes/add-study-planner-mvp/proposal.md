# Change: Study Planner MVP

## Why
Provide a study planning app for a grade 11 student in ACCP mode with ACCP and TOEFL online courses, homework, preview, review, and daily badminton, to arrange time reasonably, improve focus, and allow desktop/mobile access and classmates usage.

## What Changes
- Add Accounts: email/password with email verification; login/logout; password reset; configurable email provider (default emailjs.com).
- Add Accounts (Profile): Nickname editable with graphic numeric CAPTCHA on change; password reset requires email verification step.
- Add Study Tasks: CRUD; custom types and colors; due time; estimated duration; priority; recurrence; today's and overdue aggregation.
- Add Study Tasks (Ordering): sort scheduled tasks by start time; track scheduled vs unscheduled status.
- Add Planner: weekly/daily views; drag-to-block from tasks; conflict detection; recurring blocks.
- Add Planner (Timeline): timeline zoom in/out; auto-collapse when empty; unscheduled task pool with "Schedule"; highlight current block with countdown.
- Add Course Schedule: import ACCP/TOEFL semester course catalog; CSV/Excel import and admin-maintained catalogs (per term/class); selecting a course auto-populates the full-term schedule; fixed class times pre-populate weekly view.
- Add Course Schedule (Import Format): CSV/Excel uses one row per session; aggregated rows rejected.
- Add Focus: customizable pomodoro timer; full-screen focus; prevent sleep; log focus time to tasks.
- Add Notifications: browser permission prompt; pre-block reminders; daily unfinished summary (admin-configurable time, default 04:00 local); Web Push delivery when app is closed.
- Add Sharing: read-only share link and "copy to my plan"; configurable link expiration (default 7 days); share scope (time blocks only or include task details); no real-time collaboration.
- Add Multi-Device: responsive PWA; offline cache and retry; cloud sync; domestic-first hosting to ensure Mainland China accessibility; default Chinese and UTC+8.
- Add Roles & Authorization: System Admin (global), School Admin, Class Admin, Student with scoped permissions.
- Add Classes: join class; System Admin designates Class Admins; Class Admins arrange class-wide optional or selected plans.
- Add Optional Plans: library by scope (global/school/class); compose from courses; students adopt items into personal plans; Class Admin can promote to Selected Plan.

## Impact
- Affected specs: accounts, study-tasks, planner, course-schedule, focus, notifications, sharing, multi-device, roles, classes, optional-plans
- Affected code: web frontend (responsive PWA), backend services for auth/sync/scheduling, notification triggers, schedule import pipeline; managed database on Supabase Postgres

