## ADDED Requirements

### Requirement: Optional Plans
The system SHALL support creating and managing optional plans that can be scoped to different levels.

#### Scenario: Create plan
- **WHEN** a user creates a plan
- **THEN** it is stored with scope (global, school, class, personal) and status

#### Scenario: List plans
- **WHEN** a user lists plans
- **THEN** only plans visible to the user's scope are returned
