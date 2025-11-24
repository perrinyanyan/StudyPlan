# Change: Add Class Management System

## Why
The current system lacks a comprehensive management interface for schools, classes, and students. Administrators need a structured way to manage the hierarchy and permissions.

## What Changes
- **Backend**:
    - Enhance `admin` routes to support full CRUD for Schools, Classes, and Students.
    - Ensure strict RBAC for System Admin, School Admin, and Class Admin.
    - Add search and filtering capabilities.
- **Frontend**:
    - Create a new "Management" section in the UI.
    - Add pages for School Management, Class Management, and User/Student Management.
    - Implement "Beautiful and generous" UI using TailwindCSS.

## Impact
- **Affected Specs**: `class-management` (New Capability)
- **Affected Code**:
    - `server/src/routes/admin.ts`
    - `server/src/routes/classes.ts`
    - `client/src/App.tsx` (Routes)
    - `client/src/components/admin/*` (New Components)
