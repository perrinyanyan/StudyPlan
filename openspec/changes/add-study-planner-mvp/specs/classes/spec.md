## ADDED Requirements
### Requirement: Class Membership And Administration
Students SHALL be able to join a class. System Admins SHALL be able to designate Class Admins per class.

#### Scenario: Student joins a class via code
- **WHEN** a student enters a valid class join code for "ACCP-11A"
- **THEN** the student becomes a member of class "ACCP-11A"

#### Scenario: System Admin sets a Class Admin
- **WHEN** a System Admin assigns user "Bob" as Class Admin for "ACCP-11A"
- **THEN** Bob gains admin privileges for that class

### Requirement: Class-Level Planning Controls
Class Admins SHALL curate and publish class-wide planning resources, including optional plans and selected plans.

#### Scenario: Publish an optional plan to a class
- **WHEN** a Class Admin publishes an optional plan "TOEFL-Prep-Week1" to class "ACCP-11A"
- **THEN** all class members can browse and opt into that plan

#### Scenario: Promote selected plan to class members
- **WHEN** a Class Admin promotes a selected plan for the class
- **THEN** class members can adopt it into their personal schedules (subject to conflicts)

### Requirement: Invite Code With Admin Approval
Students SHALL request to join a class using an invite code, and Class Admins MUST approve before the student becomes a member.

#### Scenario: Join request pending approval
- **WHEN** a student submits an invite code for class "ACCP-11A"
- **THEN** a join request is created in pending status
- **AND** the student cannot access class-only resources until approved

#### Scenario: Class Admin approves join request
- **WHEN** the Class Admin approves the student's pending join request
- **THEN** the student becomes a member of the class and gains access to class resources

