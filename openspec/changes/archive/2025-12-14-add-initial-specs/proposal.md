# Change: Add Initial OpenSpec Definitions

## Why
The project currently lacks OpenSpec definitions for its core data structures and capabilities. To ensure compliance with OpenSpec standards and enable better tooling support, we need to document the existing data structures found in `server/openapi.yaml` and `client/src/types.ts`.

## What Changes
- Added OpenSpec definitions for `planner` capability (Task, TimeBlock, DailyTasks).
- Added OpenSpec definitions for `courses` capability (Course, CourseSession).
- Added OpenSpec definitions for `focus` capability (FocusStats).
- Added OpenSpec definitions for `auth` capability (UserRole, UserSettings).
- Added OpenSpec definitions for `sharing` capability (Share, SharedData).
- Added OpenSpec definitions for `plans` capability (OptionalPlan).

## Impact
- Affected specs: `planner`, `courses`, `focus`, `auth`, `sharing`, `plans`
- Affected code: None (Documentation only)
