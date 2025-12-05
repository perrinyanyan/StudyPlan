## ADDED Requirements

### Requirement: School Management
System Administrators SHALL be able to manage schools.

#### Scenario: Create School
- **WHEN** System Admin submits new school details
- **THEN** a new school is created

#### Scenario: List Schools
- **WHEN** System Admin requests school list
- **THEN** all schools are returned

### Requirement: Class Management
System Administrators and School Administrators SHALL be able to manage classes.

#### Scenario: Create Class
- **WHEN** Admin submits new class details (under a school)
- **THEN** a new class is created

### Requirement: Student Management
System, School, and Class Administrators SHALL be able to manage students.

#### Scenario: Add Student to Class
- **WHEN** Admin adds a user to a class
- **THEN** the user becomes a student of that class
