## MODIFIED Requirements

### Requirement: Task Data Structure
The system SHALL store study tasks with the following structure:
- `id` (UUID): Unique identifier
- `user_id` (UUID): Owner identifier
- `title` (String): Task description
- `content` (String, optional): Detailed task content (e.g. homework details)
- `type` (String, optional): Category (e.g., "Homework", "Review")
- `color` (String, optional): UI color code
- `due_at` (DateTime, optional): Due date/time
- `estimate_min` (Integer, optional): Estimated duration in minutes
- `priority` (Integer, optional): Priority level
- `recurrence_rule` (String, optional): RRule string for recurring tasks
- `status` (Enum): 'open' | 'done'
- `scheduling_status` (Enum): 'scheduled' | 'unscheduled'
- `created_at` (DateTime): Creation timestamp
- `tags` (Array of Strings, optional): User-defined tags

#### Scenario: Task creation with content
- **WHEN** a user creates a task with content
- **THEN** it must be stored and retrievable
