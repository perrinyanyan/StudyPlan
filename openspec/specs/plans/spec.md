# plans Specification

## Purpose
TBD - created by archiving change add-initial-specs. Update Purpose after archive.
## Requirements
### Requirement: Optional Plan Data Structure
The system SHALL store optional study plans:
- `id` (UUID): Unique identifier
- `name` (String): Plan name
- `description` (String, optional): Detailed description
- `category` (String, optional): Plan category
- `scope_type` (Enum): 'global' | 'school' | 'class' | 'personal'
- `scope_id` (UUID, optional): Identifier for the scope (school_id, class_id, or user_id)
- `status` (Enum): 'draft' | 'published'
- `created_at` (DateTime): Creation timestamp

#### Scenario: Plan publishing
- **WHEN** a plan is published
- **THEN** it becomes visible to users in scope

