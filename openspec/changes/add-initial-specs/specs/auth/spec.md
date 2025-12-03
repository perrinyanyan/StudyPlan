## ADDED Requirements

### Requirement: User Roles
The system SHALL support different user roles with varying permissions.

#### Scenario: Role assignment
- **WHEN** a user is created or updated
- **THEN** they can be assigned roles like system_admin, school_admin, class_admin, or student

### Requirement: User Settings
The system SHALL support managing user-specific settings.

#### Scenario: Update settings
- **WHEN** a user updates their settings
- **THEN** the changes are persisted
