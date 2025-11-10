## ADDED Requirements
### Requirement: Browser Notifications With Consent
The system SHALL request notification permission on first use and send notifications for upcoming time blocks and daily summaries.

#### Scenario: Request permission on first visit
- **WHEN** the user opens the app for the first time
- **THEN** the browser permission prompt for notifications is shown

#### Scenario: Upcoming block reminder
- **WHEN** a scheduled time block is about to start
- **THEN** a notification is delivered to the user

#### Scenario: Daily unfinished summary at default time
- **WHEN** it is 04:00 local time
- **THEN** a summary of unfinished tasks is sent as a notification

### Requirement: Configurable Daily Summary Time
Admins SHALL be able to configure the daily summary notification time per tenant; the default SHALL be 04:00 local time.

#### Scenario: Admin changes daily summary time
- **WHEN** an admin sets the daily summary time to 07:30
- **THEN** subsequent daily summaries are sent at 07:30 local time

### Requirement: User-Level Override For Daily Summary Time
Users SHALL be able to override the tenant-configured daily summary time for their own account. The user setting SHALL take precedence over the tenant-level time.

#### Scenario: User override takes precedence
- **WHEN** the tenant is configured for 07:30 but the user sets their own daily summary time to 06:45
- **THEN** this user receives the daily summary at 06:45 local time

### Requirement: User-Level Timezone Override
Users SHALL be able to set their own timezone for notification scheduling; when set, the user's timezone SHALL be used instead of the tenant timezone for all notification times.

#### Scenario: Schedule daily summary using user timezone
- **WHEN** a user's timezone is set to Asia/Shanghai while the tenant timezone is Asia/Singapore
- **THEN** the user's daily summary is scheduled using Asia/Shanghai

### Requirement: Web Push Delivery When App Closed
The system SHALL use Web Push with a Service Worker so that notifications are delivered even when the web app is closed.

#### Scenario: Deliver daily summary via Web Push while app is closed
- **WHEN** the daily summary trigger time occurs
- **AND** the user has previously granted permission and subscribed to push
- **THEN** the notification is delivered via Web Push even if the app is not open

