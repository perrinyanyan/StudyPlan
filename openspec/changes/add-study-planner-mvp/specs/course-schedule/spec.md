## ADDED Requirements
### Requirement: Import ACCP/TOEFL Semester Course Catalog
The system SHALL import semester course catalogs for ACCP and TOEFL and allow a student to select courses.

#### Scenario: Select a course to populate term schedule
- **WHEN** the user selects "ACCP Algebra" from the semester catalog
- **THEN** all class sessions for the term are added to the calendar

### Requirement: Pre-populate Fixed Class Times
The system SHALL pre-populate weekly view with fixed class times from imported courses.

#### Scenario: Weekly view shows fixed class sessions
- **WHEN** the user opens the weekly planner after importing courses
- **THEN** fixed class sessions appear at their scheduled times

### Requirement: CSV/Excel Course Import
The system SHALL allow admins to import course schedules via CSV or Excel files with course metadata and session times.

#### Scenario: Admin uploads CSV/Excel to create course sessions
- **WHEN** an admin uploads a valid CSV/Excel file for the 2025 Spring term
- **THEN** courses and their session times are parsed
- **AND** corresponding class sessions are created on the calendar

### Requirement: Admin-Maintained Course Catalog (Per Term/Class)
The system SHALL support an admin-maintained course catalog organized by term and class such that students can browse and select courses for auto-population.

#### Scenario: Student selects from admin-published catalog
- **WHEN** an admin publishes the catalog for term "2025 Spring" and class "ACCP-11A"
- **AND** the student browses that catalog and selects a course
- **THEN** the full set of class sessions for that course is added across the term

### Requirement: CSV/Excel Uses One Row Per Session
The CSV/Excel import format SHALL represent each class session as a separate row, including course identifier, date, start/end time, and location.

#### Scenario: One-row-per-session is enforced
- **WHEN** an admin uploads a file where each row maps to one session
- **THEN** every row becomes one calendar session
- **AND** files that attempt to aggregate multiple sessions in a single row are rejected with an error

### Requirement: CSV/Excel Includes Instructor And Attendance Policy
The CSV/Excel format SHALL include fields for instructor and attendance policy per session.

#### Scenario: Parse instructor and attendance policy fields
- **WHEN** an admin uploads a CSV/Excel with columns `instructor` and `attendance_policy`
- **THEN** those values are stored with each course session and available in the planner/session details

