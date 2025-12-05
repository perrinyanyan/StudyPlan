## ADDED Requirements

### Requirement: Task Management
The system SHALL support creating, updating, and listing tasks.

#### Scenario: Create a task
- **WHEN** a user submits a valid task payload
- **THEN** the task is created with a unique ID

### Requirement: Time Blocking
The system SHALL support creating time blocks associated with tasks or independent of them.

#### Scenario: Create a time block
- **WHEN** a user submits a valid time block payload
- **THEN** the time block is created with a unique ID

### Requirement: Daily Summary
The system SHALL provide a summary of tasks due today and overdue tasks.

#### Scenario: Get daily summary
- **WHEN** a user requests the daily summary for a specific date
- **THEN** the system returns lists of tasks due today and overdue
