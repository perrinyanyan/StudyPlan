## ADDED Requirements

### Requirement: Focus Stats Data Structure
The system SHALL aggregate focus statistics:
- `total_minutes` (Integer): Total focus time
- `sessions_count` (Integer): Number of completed sessions
- `by_day` (Map): Daily breakdown
    - Key: Date string
    - Value: Object with `minutes` and `sessions`

#### Scenario: Stats calculation
- **WHEN** requesting stats
- **THEN** total_minutes must equal sum of daily minutes
