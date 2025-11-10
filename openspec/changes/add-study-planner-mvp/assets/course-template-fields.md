# Course CSV Template Fields

- **course_code**: Unique course code. Example: ACCP-MATH-101
- **course_name**: Human-readable name. Example: Algebra I
- **term**: Academic term. Example: 2025 Spring
- **class_code**: Class identifier or code; optional. Example: ACCP-11A
- **date**: Session date in YYYY-MM-DD. Example: 2025-03-01
- **start_time**: Start time in HH:mm (24h). Example: 19:00
- **end_time**: End time in HH:mm (24h). Example: 20:30
- **location**: Room or Online label. Example: Room 203 / Online
- **instructor**: Instructor name. Example: Ms. Zhang
- **attendance_policy**: Recommended values: Required | Optional (free text allowed)

Notes:
- One row per session (strict). Aggregated rows are rejected.
- Times are interpreted in the tenant timezone by default; if the user has a timezone override, scheduling uses the user timezone.
- Leave `class_code` blank if not class-specific.
