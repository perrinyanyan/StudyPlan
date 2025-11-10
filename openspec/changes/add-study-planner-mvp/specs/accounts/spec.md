## ADDED Requirements
### Requirement: Email Accounts With Verification
Users SHALL sign up, sign in, sign out, and reset passwords via email. Accounts MUST be verified by email before full access.

#### Scenario: Sign up requires verification
- **WHEN** the user submits email and password to sign up
- **THEN** a verification email is sent
- **AND** the user can access protected features only after verifying the email

#### Scenario: Password reset via email link
- **WHEN** the user requests a password reset
- **THEN** a reset link is sent to the email
- **AND** the user can set a new password

#### Scenario: Password reset requires email verification step
- **WHEN** the user follows the password reset link sent to their email
- **THEN** the system verifies the link/code ownership
- **AND** only then allows setting a new password

### Requirement: Configurable Email Delivery Provider (Default emailjs.com)
The system SHALL allow configuration of the email delivery provider for verification and reset emails, with the default provider being emailjs.com.

#### Scenario: Use default emailjs.com for verification emails
- **WHEN** no custom provider is configured
- **AND** a user signs up and requires email verification
- **THEN** the verification email is sent via emailjs.com successfully

### Requirement: Nickname With Captcha On Change
Each account SHALL have a nickname. Changing the nickname SHALL require passing a graphic numeric CAPTCHA challenge.

#### Scenario: Change nickname with CAPTCHA
- **WHEN** the user attempts to change their nickname
- **THEN** a graphic numeric CAPTCHA is presented
- **AND** only upon successful CAPTCHA entry is the nickname updated

