# sharing Specification

## Purpose
TBD - created by archiving change add-initial-specs. Update Purpose after archive.
## Requirements
### Requirement: Share Data Structure
The system SHALL manage share links:
- `id` (UUID): Unique identifier
- `token` (String): Secret access token
- `scope` (Enum): 'full' | 'blocks_only'
- `expires_at` (DateTime): Expiration timestamp

#### Scenario: Link generation
- **WHEN** creating a share link
- **THEN** generate a unique token and set expiration

### Requirement: Shared Data Structure
The system SHALL return shared content structure:
- `share` (Object): Metadata (scope, expiration)
- `tasks` (Array of Task, optional): Included only if scope is 'full'
- `blocks` (Array of SharedBlock): Time blocks (anonymized if scope is 'blocks_only')
    - `start_at` (DateTime)
    - `end_at` (DateTime)
    - `task_id` (UUID, optional)

#### Scenario: Accessing shared view
- **WHEN** accessing with valid token
- **THEN** return blocks filtered by scope

