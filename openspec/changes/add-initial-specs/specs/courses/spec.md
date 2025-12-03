## ADDED Requirements

### Requirement: Course Management
The system SHALL support listing courses and their sessions.

#### Scenario: List courses
- **WHEN** a user requests the list of courses
- **THEN** the system returns a list of courses filtered by term or school if specified

### Requirement: Course Sessions
The system SHALL support listing sessions for a specific course.

#### Scenario: List course sessions
- **WHEN** a user requests sessions for a valid course ID
- **THEN** the system returns the list of sessions
