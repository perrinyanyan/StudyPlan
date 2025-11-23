# Change: Settings Enhancements

## Why
Users need to be able to manage their account security (password) and profile identity (nickname, avatar) directly from the application.

## What Changes
-   **Database**: Add `avatar_url` to `users` table.
-   **Backend**:
    -   Add `POST /auth/change-password` endpoint.
    -   Add `POST /auth/profile/avatar` endpoint (file upload).
    -   Update `GET /auth/me` to return avatar.
-   **Frontend**:
    -   Update `SettingsPage` to include "Profile" and "Security" sections.
    -   Implement Avatar upload UI.
    -   Implement Nickname edit UI (with Captcha).
    -   Implement Password change UI.

## Impact
-   **Affected specs**: accounts, settings
-   **Affected code**: `server/src/routes/auth.ts`, `client/src/components/settings/SettingsPage.tsx`, `client/src/hooks/useAuth.ts`
