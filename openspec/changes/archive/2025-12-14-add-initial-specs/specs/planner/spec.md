## ADDED Requirements

### Requirement: Task Data Structure
The system SHALL store study tasks with the following structure:
- `id` (UUID): Unique identifier
- `user_id` (UUID): Owner identifier
- `title` (String): Task description
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

#### Scenario: Task creation
- **WHEN** a user creates a task
- **THEN** it must have a valid UUID and owner

### Requirement: TimeBlock Data Structure
The system SHALL store time blocks for scheduling:
- `id` (UUID): Unique identifier
- `user_id` (UUID): Owner identifier
- `task_id` (UUID, optional): Link to a task
- `start_at` (DateTime): Start time
- `end_at` (DateTime): End time
- `recurrence_rule` (String, optional): RRule string
- `created_at` (DateTime): Creation timestamp

#### Scenario: Time scheduling
- **WHEN** a block is created
- **THEN** start_at must be before end_at

### Requirement: Daily Tasks Aggregation
The system SHALL provide an aggregated view of tasks for a specific date:
- `today`: List of tasks due on that date
- `overdue`: List of open tasks due before that date

#### Scenario: Daily view
- **WHEN** requesting daily tasks
- **THEN** distinct lists for today and overdue are returned
