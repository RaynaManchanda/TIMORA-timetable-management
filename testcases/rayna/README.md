# Rayna Manchanda (240601) - Adaptive Rescheduling & AI Assistance

Script: `npm run test:rayna` (needs `npm run test:db:up`) - file `rayna.testcases.test.js`.

Manual steps: sign in as `admin@timora.edu`, then:

| TC | Case | In the app |
| :-- | :--- | :--- |
| TC01 | Report a valid disruption | **Disruptions**: type *Faculty absence*, a teacher, Tuesday, slot -> **Analyze impact**; the disruption appears in the list of recorded disruptions |
| TC02 | Missing affected entity | **Test console** -> TC02 (the form always has a teacher selected, so the console sends the empty ID) -> 400 *Disruption requires an affected entity ID.* |
| TC03 | Impact of a faculty absence | After **Analyze impact** the *Affected classes* table lists only that teacher's classes at that day/slot |
| TC04 | Generate and rank alternatives | The alternative cards are ordered by score; the best one is marked *Recommended* |
| TC05 | Approve -> new version | Select an alternative -> **Approve selected**. **Versions & analytics** shows a new Active version, the old one Archived; **Roll back** on the archived one restores it. The disruption becomes Resolved |
| TC06 | AI assistance | **AI assistant**: type *Prof Turing is unavailable on Tuesday* -> **Interpret** (awaiting human validation) -> **Validate**; then **Explain** on an alternative |
| TC07 | Invalid disruption type | **Test console** -> TC07 (the type list only offers valid types) -> 400 *Invalid disruption type: INVALID_TYPE* |
| TC08 / TC09 | Approval without alternative / disruption id | **Test console** -> TC08 / TC09: approval without an alternative / without a disruption id -> 400 with the messages in the test document |
| TC10 | No matching entries | Record an absence for a teacher who has no classes (e.g. *Dr. Arun Gupta*, Monday): no class is affected |
| TC11 | No Changes Needed | Same disruption -> the only option shown is *No Changes Needed* |
| TC12 / TC13 | Empty prompt / validation without constraint | **AI assistant**: click Interpret with an empty box -> *Please type a natural-language prompt.* (the page stops it); the server's own answer, *Natural language prompt text is required.*, is shown by **Test console** -> TC12; TC13 (validation without a constraint) is **Test console** -> TC13 |

The scripted TC05 changes the throw-away test database only, never your dev data. Manual TC05 does change the dev timetable: roll it back afterwards (Versions & analytics).
