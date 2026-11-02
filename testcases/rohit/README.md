# Rohit - Frontend, Analytics & User Workflows

Script: `npm run test:rohit` (needs `npm run test:db:up`) - file `rohit.testcases.test.js`. It signs in through the real API, checks the data each screen receives, and checks the real frontend files (`public/index.html`, `app.js`) contain the controls.

Manual steps (http://localhost:3000, password `Password123!`):

| TC | Case | In the app |
| :-- | :--- | :--- |
| TC01 | Sign-in and role routing | Sign in as `admin@timora.edu` -> Dashboard; as `faculty@timora.edu` or `student@timora.edu` -> Timetable. A wrong password is refused (real authentication, not demo data) |
| TC02 | Dashboard | Quality score, avoidable gaps, scheduled classes, open disruptions, *Needs attention*, *Recent activity* |
| TC03 | Weekly timetable | **Timetable**: Monday-Friday x 9 time slots, subject/teacher/room, empty periods, lunch |
| TC04 | View selector | Change **View** from Week to Today: one day shows (phone: use the day chips) |
| TC05 | Print | **Print** opens the browser print dialog |
| TC06 | Google Calendar | **Sync to Google Calendar** opens the sync dialog; connect on **Settings** first. Connected: events are copied; not connected: the message says so |
| TC07 | Academic data tabs | **Academic data**: Subjects / Faculty / Rooms / Sections tabs show their records |
| TC08 | Add record | **Add record** opens a real form; Save stores the room/subject/teacher (it is not a demo any more) and Delete removes it |
| TC09 | Disruption controls | **Disruptions**: Type, Faculty/Room, Day, Slot and **Analyze impact** |
| TC10 | Impact analysis | Analyze impact lists affected classes and alternative options |
| TC11 | Approve alternative | Select an option -> **Approve selected**: really saved as a new version |
| TC12 | Generation settings | **Generate**: section, maximum gap, mandatory break, **Generate** |
| TC13 | Generation result | Quality score, avoidable gaps, hard-constraint conflicts, longest day, grid - computed by the server |
| TC14 | Approve / reject draft | **Approve and publish** makes the draft the active timetable; **Reject** deletes the draft |
| TC15 | Versions and analytics | **Versions & analytics**: versions with dates/status, and analytics from the real timetable |
| TC16 | Rollback | **Roll back** beside an archived version restores it |
| TC17 | Sign out | **Sign out**: the sign-in screen appears and the loaded timetable is cleared |
| TC18 | Role access | Sign in as faculty, then student: Timetable only, no administrator menu, only their own classes |

Differences from the original test document: the old "Fail"/"demonstration" results (TC01 password, TC06, TC08, TC11, TC14, TC16) are now real, persisted features.
