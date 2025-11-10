## ADDED Requirements
### Requirement: Study Tasks With Custom Types And Colors
The system SHALL allow users to create, read, update, and delete tasks with attributes: custom type, color, due datetime, estimated duration, priority, and recurrence.

#### Scenario: Create task with custom type and color
- **WHEN** the user creates a task named "TOEFL Reading" with type "TOEFL" and color "blue"
- **THEN** the task is saved with the provided attributes

### Requirement: Daily Aggregation For Today And Overdue
The system SHALL present a daily list that aggregates tasks due today and overdue tasks.

#### Scenario: Daily list shows due-today and overdue
- **WHEN** the date changes to today
- **THEN** tasks due today and tasks overdue are shown in the daily list

### Requirement: Task Ordering By Time
The system SHALL sort scheduled tasks by start time in ascending order within their day view. Unscheduled tasks SHALL appear in a separate section.

#### Scenario: Tasks sorted and unscheduled separated
- **WHEN** tasks include scheduled items at 09:00 and 14:00 and an unscheduled task
- **THEN** the scheduled tasks are listed as 09:00, then 14:00
- **AND** the unscheduled task is shown in a separate "Unscheduled" section

### Requirement: Task Scheduling Status
Each task SHALL have a scheduling status: "scheduled" if it has at least one time block, otherwise "unscheduled".

#### Scenario: Changing status after scheduling
- **WHEN** an unscheduled task is assigned a time block in the planner
- **THEN** its status becomes "scheduled"
