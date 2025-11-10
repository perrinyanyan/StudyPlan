## ADDED Requirements
### Requirement: Responsive PWA With Offline And Sync
The system SHALL be a responsive web app usable on desktop and mobile, installable as a PWA, operate with basic offline caching, and synchronize data when connectivity is restored. Defaults: language zh-CN and timezone UTC+8.

#### Scenario: Use offline then sync on reconnect
- **WHEN** the user edits tasks while offline
- **THEN** changes are cached locally and synchronized when connectivity is restored

### Requirement: China-Accessible Hosting
The system SHALL be hosted using cloud and CDN endpoints accessible from Mainland China.

#### Scenario: Mainland access to app and authentication
- **WHEN** a user in Mainland China visits the app
- **THEN** the application loads and the user can sign in successfully

### Requirement: Domestic-First Hosting Strategy
The system SHALL prioritize deployment in Mainland China cloud regions (e.g., Aliyun, Tencent Cloud, Huawei Cloud) to ensure low latency and reliability, with CDN distribution for nationwide access.

#### Scenario: Deploy to domestic region for low latency
- **WHEN** the application is deployed for production
- **THEN** primary hosting and data storage reside in a domestic cloud region
- **AND** users across Mainland China experience low-latency access
