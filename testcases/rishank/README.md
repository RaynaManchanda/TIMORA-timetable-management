# Rishank Mishra (240498) - Core Scheduling & Optimization

Script: `npm run test:rishank` (pure Node, no database needed) - file `rishank.testcases.test.js`.

| TC | Case | Script checks | Do it in the app (sign in as `admin@timora.edu`, page **Generate**) |
| :-- | :--- | :--- | :--- |
| TC01 | Feasible timetable | status OPTIMAL/FEASIBLE, no conflicts | Pick a section, click **Generate**: the result shows *Hard-constraint conflicts 0* and a conflict-free grid |
| TC02 | Infeasible input (room capacity) | status INFEASIBLE, message `capacity >= 60` | Pick a section, type **500** in *Students in section (optional what-if)*, click **Generate**: it refuses with *No lecture/tutorial room with capacity >= 500 exists ...* and stores nothing (also a button in **Test console**) |
| TC03 | No faculty double-booking | validator rejects same faculty, day and slot | **Timetable** grid: no teacher appears twice in one slot; the database also refuses it (see Raghav TC12) |
| TC04 | All required sessions scheduled once | 12 sessions, counts per type | Generate, then count the classes per subject in the grid against the credits listed on **Academic data -> Subjects** |
