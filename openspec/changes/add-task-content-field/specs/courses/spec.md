## MODIFIED Requirements

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
- `content` (String, optional): Session details (e.g. topic covered)
- `created_at` (DateTime): Creation timestamp

#### Scenario: Session import with content
- **WHEN** a session is imported from CSV
- **THEN** the content field is populated
