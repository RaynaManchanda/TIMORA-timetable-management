# Raghav Yadav (240598) - Backend, Database, Quality & DevOps

Scripts (need `npm run test:db:up`):

* `npm run test:raghav` - the whole Jest backend suite (the cases are the tests named `TC01 ...` to `TC20 ...` in `tests/backend/`).
* `npm run test:testcases -- raghav` - the same, as one PASS/FAIL line per test case.
* `postman/TIMORA-backend.postman_collection.json` - manual endpoint checks (TC01-TC12, TC15-TC20) against a running app: `npx newman run testcases/raghav/postman/TIMORA-backend.postman_collection.json` (or import it into Postman and run the collection).
* `load/timetable-load.k6.js` - TC20 load test: `k6 run testcases/raghav/load/timetable-load.k6.js` (100 users, 2 minutes, p95 < 500 ms, errors < 1%).

| TC | Case | Test file in `tests/backend/` |
| :-- | :--- | :--- |
| TC01-TC05, TC19 | register, duplicate, login, wrong password, bcrypt hash, lockout | `auth.test.js` |
| TC06-TC08, TC18 | no token, tampered/expired token, role check, SQL injection | `access-control.test.js` |
| TC09-TC12 | create entry, validation, fetch by section, double booking | `timetable-api.test.js` |
| TC13 | rollback of a failed version save | `timetable-versions.test.js` |
| TC14, TC15 | notifications on approval, list and mark read | `notifications.test.js` |
| TC16, TC17 | calendar events, expired authorisation | `calendar.test.js` |
| TC20 | 100 concurrent users, health check | `performance.test.js` |

**Test console** (administrator menu) runs TC06, TC07 (tampered token), TC08, TC10, TC11, TC12, TC18, TC19 and TC20 live with PASS/FAIL. In the app: **Settings** shows the connection state (TC16/TC17), the bell/**Notifications** page lists and marks notifications read (TC14/TC15), and signing in with a wrong password six times locks the account for 15 minutes (TC19).
