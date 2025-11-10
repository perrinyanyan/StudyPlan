## ADDED Requirements
### Requirement: Read-only Share And Copy
The system SHALL generate read-only share links for a plan. Viewers SHALL be able to copy the shared plan into their own account. Real-time collaboration is out of scope.

#### Scenario: Copy from a read-only shared link
- **WHEN** a viewer opens a shared link and chooses "Copy to my plan"
- **THEN** the plan is duplicated into the viewer's account

### Requirement: Share Link Expiration
The system SHALL support expiring share links with a configurable expiration time. The default expiration SHALL be 7 days.

#### Scenario: Share link expires after configured duration
- **WHEN** the owner creates a share link that expires in 7 days
- **AND** the viewer tries to access it after 7 days
- **THEN** the link is invalid and access is denied

#### Scenario: Share link defaults to 7-day expiration
- **WHEN** the owner creates a share link without specifying an expiration
- **THEN** the link expires 7 days after creation

### Requirement: Share Content Scope
The system SHALL allow the owner to choose the share scope: only time blocks or include task details.

#### Scenario: Share time blocks only
- **WHEN** the owner selects "Time blocks only" when creating a share link
- **THEN** viewers see the schedule blocks without task titles, notes, or other details

