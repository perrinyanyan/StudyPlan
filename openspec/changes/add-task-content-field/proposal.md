# Change: Add Task Content Field

## Why
Users need to store and view detailed content (e.g., homework specifics) alongside the task title. This needs to be supported through the entire flow from CSV import to planner views.

## What Changes
- Database: Add `content` column to `tasks` and `course_sessions`.
- API: Update import and apply endpoints to handle `content`.
- UI: Update planner views (Day, List) to display `content`.

## Impact
- Affected specs: `planner`, `courses`
- Affected code: `server/src/routes/plans.ts`, `client/src/components/planner/*`
