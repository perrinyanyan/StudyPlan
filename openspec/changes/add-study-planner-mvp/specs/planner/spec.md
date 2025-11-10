## ADDED Requirements
### Requirement: Weekly And Daily Time Blocking
The system SHALL provide weekly and daily calendar views, support drag-and-drop from tasks to create time blocks, and detect scheduling conflicts.

#### Scenario: Create a time block from a task
- **WHEN** the user drags a task into the calendar
- **THEN** a time block is created and conflicts are detected and surfaced if overlapping

### Requirement: Recurring Time Blocks
The system SHALL support recurring time blocks (e.g., daily, weekly, custom rules).

#### Scenario: Create a weekly recurring block
- **WHEN** the user sets a block to repeat every Monday at 19:00 for 90 minutes
- **THEN** the recurring blocks are generated across future weeks

### Requirement: Timeline View With Zoom And Auto-Collapse
The system SHALL provide a timeline view that supports zoom in/out. The timeline SHALL default to a collapsed view when there are no blocks in the visible range.

#### Scenario: Zoom and collapsed-by-default
- **WHEN** the user opens the timeline on a day with no scheduled blocks
- **THEN** the timeline renders in a collapsed state
- **AND** the user can zoom in/out to adjust the visible time range

### Requirement: Unscheduled Task Pool With Schedule Button
The system SHALL display unscheduled tasks in a task pool at the bottom of the planner and provide a "Schedule" action to assign a specific time.

#### Scenario: Schedule from the unscheduled task pool
- **WHEN** the user clicks "Schedule" on an unscheduled task in the pool
- **THEN** the system prompts for a time slot and creates a corresponding time block

### Requirement: Current Task Highlight With Countdown
The system SHALL highlight the currently active block and show a countdown to its end.

#### Scenario: Highlight current block with countdown
- **WHEN** the current time is within a scheduled block
- **THEN** the block is visually emphasized
- **AND** a countdown indicates the remaining time in the block
