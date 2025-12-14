# auth Specification

## Purpose
TBD - created by archiving change add-initial-specs. Update Purpose after archive.
## Requirements
### Requirement: User Role Data Structure
The system SHALL support the following user roles:
- `system_admin`: Global administrator
- `school_admin`: School-level administrator
- `class_admin`: Class-level administrator
- `student`: Standard user

#### Scenario: Role assignment
- **WHEN** assigning a role
- **THEN** it must be one of the defined values

### Requirement: User Settings Data Structure
The system SHALL store user preferences:
- `daily_summary_time` (String, optional): HH:mm for daily summary
- `timezone` (String, optional): User's preferred timezone (e.g., "Asia/Shanghai")
- `focus_duration_minutes` (Integer, optional): Default focus session length
- `focus_start_sound` (String, optional): Sound file for focus start
- `focus_end_sound` (String, optional): Sound file for focus end

#### Scenario: Settings update
- **WHEN** updating settings
- **THEN** timezone must be a valid IANA string

### Requirement: Captcha Data Structure
The system SHALL provide graphic numeric CAPTCHAs:
- `id` (String): Unique identifier
- `svg` (String): SVG image data

#### Scenario: Captcha generation
- **WHEN** requesting a captcha
- **THEN** return id and svg content

### Requirement: Push Subscription Data Structure
The system SHALL store web push subscriptions:
- `endpoint` (String): Browser push service endpoint
- `keys` (Object): Encryption keys
    - `p256dh` (String): Public key
    - `auth` (String): Auth secret
- `userAgent` (String, optional): Browser user agent string

#### Scenario: Push registration
- **WHEN** a client subscribes
- **THEN** store endpoint and keys

