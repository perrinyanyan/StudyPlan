## ADDED Requirements

### Requirement: Schedule Sharing
The system SHALL support sharing schedules via unique tokens.

#### Scenario: Create share link
- **WHEN** a user creates a share link
- **THEN** a unique token is generated with specified scope and expiration

#### Scenario: Access shared data
- **WHEN** a valid share token is used
- **THEN** the system returns the shared tasks and blocks according to the scope
