## ADDED Requirements
### Requirement: Role Model And Scopes
The system SHALL support roles and scoped assignments:
- Roles: System Admin, School Admin, Class Admin, Student
- Scopes: global (system), school, class
A user MAY hold multiple roles across different scopes.

#### Scenario: System admin assigns class admin
- **WHEN** a System Admin designates user "Alice" as Class Admin of class "ACCP-11A"
- **THEN** Alice obtains Class Admin privileges scoped to "ACCP-11A"

### Requirement: Authorization Controls
Only authorized roles SHALL perform privileged actions:
- Only System Admin may promote/demote admins at any scope
- School/Class Admins may publish optional plans to their scope and configure planner/notification settings for their scope
- Students SHALL NOT perform admin-only actions

#### Scenario: Class Admin publishes optional plan; student blocked
- **WHEN** a Class Admin publishes an optional plan to class "ACCP-11A"
- **THEN** class members can view and select from it
- **AND** a Student attempting the same action is denied

### Requirement: Multi-tenant School And Class Hierarchy
The system SHALL support multiple schools, each with classes; role permissions MUST be enforced by scope boundaries.

#### Scenario: School-level isolation
- **WHEN** a School Admin from School "S1" attempts to manage a class in School "S2"
- **THEN** the action is denied due to scope isolation
