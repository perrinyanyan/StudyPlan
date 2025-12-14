# courses Specification

## Purpose
TBD - created by archiving change add-initial-specs. Update Purpose after archive.
## Requirements
### Requirement: Course Data Structure
The system SHALL store course information:
- `id` (UUID): Unique identifier
- `code` (String): Course code (e.g., "MATH101")
- `name` (String): Course name
- `term` (String): Academic term
- `school_id` (UUID, optional): Associated school
- `created_at` (DateTime): Creation timestamp

#### Scenario: Course lookup
- **WHEN** listing courses
- **THEN** code and name are required fields

### Requirement: Course Session Data Structure
The system SHALL store individual class sessions:
- `id` (UUID): Unique identifier
- `course_id` (UUID): Parent course
- `date` (Date): Session date (YYYY-MM-DD)
- `start_time` (Time): Start time (HH:mm:ss)
- `end_time` (Time): End time (HH:mm:ss)
- `location` (String, optional): Classroom or link
- `class_id` (UUID, optional): Specific class group
- `instructor` (String): Instructor name
- `attendance_policy` (String): Attendance rules
- `created_at` (DateTime): Creation timestamp

#### Scenario: Session scheduling
- **WHEN** a session is created
- **THEN** it must be linked to a valid course

