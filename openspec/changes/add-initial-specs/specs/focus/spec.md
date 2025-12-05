## ADDED Requirements

### Requirement: Focus Sessions
The system SHALL support starting and ending focus sessions, and tracking statistics.

#### Scenario: Start focus session
- **WHEN** a user starts a focus session
- **THEN** the system records the start time and associated task (if any)

#### Scenario: End focus session
- **WHEN** a user ends an active focus session
- **THEN** the system records the end time and calculates duration

### Requirement: Focus Statistics
The system SHALL provide statistics on focus duration and session counts.

#### Scenario: Get focus stats
- **WHEN** a user requests focus stats for a date range
- **THEN** the system returns total minutes, session count, and daily breakdown
