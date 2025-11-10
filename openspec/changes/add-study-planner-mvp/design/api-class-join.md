# API Draft: Class Join Request & Approval

Base URL prefix: `/api/v1`
Auth: Bearer JWT (user auth). RBAC enforced server-side + DB RLS.

## POST /classes/join-requests
Create a join request using an invite code.

- Auth: Student (any authenticated user)
- Body:
```json
{ "invite_code": "ACCP11A-XYZ123" }
```
- Responses:
  - 201 Created
```json
{ "id": "<request_id>", "class_id": "<uuid>", "status": "pending" }
```
  - 400 InvalidCode | 409 DuplicatePending | 401/403 Unauthorized
- Business rules:
  - Resolve `class_id` by invite code; deny if code invalid/expired.
  - If an existing `pending` request for the same class/user exists, return 409.
  - Insert `class_join_requests(status=pending)`.

## GET /classes/{class_id}/join-requests?status=pending
List join requests for a class (default pending).

- Auth: Class Admin (or School/System Admin of the scope)
- Responses 200 OK:
```json
{
  "items": [
    {"id":"...","user_id":"...","status":"pending","created_at":"..."}
  ]
}
```
- Errors: 403 Forbidden if not admin of the class.

## POST /classes/{class_id}/join-requests/{request_id}/approve
Approve a pending join request and add membership.

- Auth: Class Admin (or School/System Admin of the scope)
- Body (optional):
```json
{ "note": "Welcome" }
```
- Responses:
  - 200 OK `{ "status": "approved" }`
  - 409 Conflict if not `pending`
- Effects:
  - Update request to `approved`, set `decided_at`, `decided_by`.
  - Upsert `class_memberships(user_id, class_id)`.
  - Enqueue a notification to the student.

## POST /classes/{class_id}/join-requests/{request_id}/reject
Reject a pending join request.

- Auth: Class Admin (or School/System Admin of the scope)
- Body (optional):
```json
{ "reason": "Not in this class" }
```
- Responses:
  - 200 OK `{ "status": "rejected" }`
  - 409 Conflict if not `pending`
- Effects:
  - Update request to `rejected`, set `decided_at`, `decided_by`.

## GET /classes/{class_id}/members
List class members.

- Auth: Class Admin (or School/System Admin). Student can list if member.
- Response 200 OK:
```json
{
  "members": [
    {"user_id":"...","nickname":"...","joined_at":"..."}
  ]
}
```

## Security & Validation
- Server validates invite code → class mapping (service role DB access).
- Enforce RBAC: only class admins can approve/reject.
- Idempotency: approving an already-approved request should be safe (no duplicate membership).
- Rate limit POST join-requests per user.
