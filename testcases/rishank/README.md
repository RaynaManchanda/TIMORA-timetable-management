# Rishank Mishra (240498) - Core Scheduling & Optimization

Script: `npm run test:rishank` (pure Node, no database needed) - file `rishank.testcases.test.js`.

| TC | Case | Script checks | Do it in the app (sign in as `admin@timora.edu`, page **Generate**) |
| :-- | :--- | :--- | :--- |
| TC01 | Feasible timetable | status OPTIMAL/FEASIBLE, no conflicts | Pick a section, click **Generate**: the result shows *Hard-constraint conflicts 0* and a conflict-free grid |
| TC02 | Infeasible input (room capacity) | status INFEASIBLE, message `capacity >= 60` | Script only: the app generates from the imported college data, which has no oversize section. In the app the closest check is **Generate** on a section that has no classes: it refuses with *The selected sections have no regular classes to plan.* |
| TC03 | No faculty double-booking | validator rejects same faculty, day and slot | **Timetable** grid: no teacher appears twice in one slot; the database also refuses it (see Raghav TC12) |
| TC04 | All required sessions scheduled once | 12 sessions, counts per type | Generate, then count the classes per subject in the grid against the credits listed on **Academic data -> Subjects** |
