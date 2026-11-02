# Test cases by team member

Every test case of the four test documents lives in the folder of its owner. Each case can be shown **two ways**: run the automated script from Node, or perform it by hand in the app (steps in each folder's README).

| Folder | Owner | Document | Cases | Run |
| :--- | :--- | :--- | :--- | :--- |
| `rishank/` | Rishank Mishra | `TIMORA_Rishank_TestCases.pdf` | TC01-TC04 | `npm run test:rishank` |
| `rayna/` | Rayna Manchanda | `TIMORA_Rayna_testcases.pdf` | TC01-TC13 | `npm run test:rayna` |
| `rohit/` | Rohit | `TIMORA_Rohit_Frontend_Test_Cases.docx` | TC01-TC18 | `npm run test:rohit` |
| `raghav/` | Raghav Yadav | `TIMORA_Raghav_testcases.pdf` | TC01-TC20 | `npm run test:raghav` |

## Run everything

```bash
npm run test:db:up                 # isolated PostgreSQL on port 5433 (once)
npm run test:testcases             # one PASS/FAIL line per test case, all four people
npm run test:testcases -- rayna    # only one person
```

For the manual demonstrations start the app (`npm run db:up`, `npm run dev`) and open http://localhost:3000.
Demo accounts (password `Password123!`): `admin@timora.edu` (coordinator), `faculty@timora.edu`, `student@timora.edu`.

Each case's scripted test is in `<name>/<name>.testcases.test.js`, titled with its id (`TC05 - ...`).
Raghav's backend tests are the Jest suite in `tests/backend/` (they are named `TC01 ...` too); his Postman collection and k6 load script are in `raghav/`.
