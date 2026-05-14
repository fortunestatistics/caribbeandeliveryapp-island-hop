# IslandHop Test Credentials

## Authentication
The app supports two auth flows:
- **JWT Bearer** (used by `/api/auth/register` and `/api/auth/login`) — primary
- Session cookie (`session_token`) — for OAuth/legacy flows

The backend helper `get_current_user_from_request` accepts **either** a `session_token` cookie or a JWT Bearer token in `Authorization: Bearer <token>`.

## How to create a test user
There is no seeded admin/test account. Register a user fresh:

```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@islandhop.test","password":"Test1234!","name":"QA Tester","user_type":"customer"}'
```

The response contains `access_token` (JWT). Use it as:
```
Authorization: Bearer <access_token>
```

## Known working test users (created during dev/test runs)
- (none persisted — recreate on each test run with a unique email like `sched_test_<timestamp>@test.com`)

## Notes for testing agent
- Customer-facing endpoints requiring auth: `/api/scheduled-orders`, `/api/recurring-orders`, `/api/addresses`, `/api/promo-codes`, `/api/support/*`.
- Vendor/Driver-specific endpoints assume the user has the corresponding `user_type`. Register with `"user_type":"restaurant"` or `"driver"` if needed.
- Admin endpoints (`/api/admin/*`) DO enforce `user_type == "admin"` and return 403 otherwise. To test, register with `"user_type":"admin"` or manually update a user's `user_type` field in Mongo before calling them.
