## 1. Implementation
- [x] 1.1 Accounts: Email signup/login/logout/reset with verification; configurable email provider (default emailjs.com); nickname change requires graphic numeric CAPTCHA; reset requires verified email link
- [x] 1.2 Study Tasks: CRUD; custom types/colors; due; estimate; priority; recurrence; today's/overdue aggregation
- [x] 1.2.1 Study Tasks Enhancements: Order scheduled tasks by start time; track scheduled vs unscheduled status
- [x] 1.3 Planner: Weekly/daily views; drag/resize blocks; conflict detection; recurring blocks; timeline zoom/auto-collapse; unscheduled task pool with "Schedule"; highlight current block with countdown
- [x] 1.4 Course Schedule: Import ACCP/TOEFL catalog; CSV/Excel import (one row per session; include instructor + attendance policy); admin-maintained catalogs (per term/class); pick courses; auto-populate term schedule; pre-populate weekly view
- [x] 1.5 Focus: Customizable pomodoro (25/5 default + custom); full-screen; prevent sleep; log focus time
- [x] 1.6 Notifications: Request permission on first visit; pre-block reminders; daily summary at admin-configurable time (default 04:00 local) with per-user override and per-user timezone override; Web Push + Service Worker delivery
- [x] 1.7 Sharing: Read-only link; copy to my plan; link expiration (default 7 days); share scope (time blocks only or include task details); no real-time collaboration
- [/] 1.8 Multi-Device: Responsive PWA; offline cache + retry; cloud sync; domestic-first hosting + CN-accessible CDN/domains; default zh-CN + UTC+8
- [x] 1.9 Roles & Authorization: Role model (System Admin, School Admin, Class Admin, Student); scoped permissions; admin assignment flows; enforcement on privileged actions
- [x] 1.10 Classes: Join class via invite code with admin approval; System Admin designates Class Admin; Class Admin publishes class-wide Optional/Selected Plans
- [x] 1.11 Optional Plans: Scoped library; compose from courses; students adopt items into personal schedule; Class Admin promote to Selected Plan

## 2. Validation
- [ ] 2.1 Write minimal E2E scenarios mapping to each requirement
- [ ] 2.2 openspec validate add-study-planner-mvp --strict

