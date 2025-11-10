## ADDED Requirements
### Requirement: Optional Plans Library (Scoped)
The system SHALL provide an Optional Plans library browsable by students. Optional Plans MAY be published at different scopes: global, school, or class. Only admins of the corresponding scope may create or publish Optional Plans at that scope.

#### Scenario: Class-scoped Optional Plan is visible to members
- **WHEN** a Class Admin publishes an Optional Plan to class "ACCP-11A"
- **THEN** members of "ACCP-11A" can browse and view that Optional Plan

### Requirement: Build Optional Plans From Courses
Admins SHALL be able to compose Optional Plans by importing courses from the course catalog or CSV/Excel.

#### Scenario: Admin composes an Optional Plan from catalog
- **WHEN** a Class Admin selects two TOEFL courses from the catalog into a new Optional Plan
- **THEN** the Optional Plan contains those courses as selectable items

### Requirement: Adopt Items From Optional Plan Into Personal Schedule
Students SHALL be able to adopt selected items (courses, sessions, or tasks) from an Optional Plan into their personal schedule, with conflict detection.

#### Scenario: Adopt a course from Optional Plan into personal plan
- **WHEN** a student selects a course from an Optional Plan and confirms adoption
- **THEN** the course's sessions are added to the student's calendar with conflicts surfaced

### Requirement: Promote Optional Plan To Selected Plan (Class)
Class Admins SHALL be able to promote an Optional Plan to a "Selected Plan" for their class, making it the default recommendation for class members.

#### Scenario: Promote to Selected Plan
- **WHEN** a Class Admin promotes Optional Plan "TOEFL-Prep-Week1" to the class
- **THEN** class members see it as the class's Selected Plan and can adopt it with one click
