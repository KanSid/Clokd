# Graph Report - .  (2026-06-27)

## Corpus Check
- 37 files · ~27,816 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 125 nodes · 158 edges · 18 communities detected
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `main()` - 10 edges
2. `Supabase` - 8 edges
3. `POST()` - 8 edges
4. `sync_attendance()` - 7 edges
5. `rows_to_dicts()` - 6 edges
6. `sync_employees()` - 6 edges
7. `sync_holidays()` - 5 edges
8. `GET()` - 5 edges
9. `sync_departments()` - 4 edges
10. `warn_incomplete_employees()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `ok()`  [EXTRACTED]
  src\app\api\iclock\devicecmd\route.ts → src\app\api\iclock\cdata\route.ts
- `POST()` --calls--> `createAdminClient()`  [EXTRACTED]
  src\app\api\iclock\devicecmd\route.ts → src\app\api\iclock\cdata\route.ts
- `GET()` --calls--> `error()`  [EXTRACTED]
  src\app\api\iclock\getrequest\route.ts → src\app\api\iclock\cdata\route.ts
- `POST()` --calls--> `error()`  [EXTRACTED]
  src\app\api\iclock\devicecmd\route.ts → src\app\api\iclock\cdata\route.ts
- `POST()` --calls--> `isAllowedSN()`  [EXTRACTED]
  src\app\api\iclock\devicecmd\route.ts → src\app\api\iclock\getrequest\route.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (19): _coerce_date(), _coerce_dt(), connect_mdb(), latest_mdb(), load_env(), main(), POLL the latest sorted by time eTimeTrackLite .mdb file in the repo root and syn, Return the set of existing values for `column` (paged). (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (3): fetchEmployees(), handleDelete(), handleSave()

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (12): Admin Panel Page, Admin User Management (create/delete users), Supabase Admin Client (service_role), API Route: Admin Users (GET/DELETE), API Route: Auth Callback (OAuth code exchange), Supabase Server Client (@/lib/supabase/server), Login Page (email/password), Middleware Auth & Role Guard (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.21
Nodes (5): extractHoursMinutes(), formatMinutes(), formatTime(), metricsFromRow(), timeToMinutes()

### Community 4 - "Community 4"
Cohesion: 0.44
Nodes (9): createAdminClient(), deviceTimeToISO(), error(), GET(), isAllowedSN(), ok(), parseBody(), parseLine() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (0): 

### Community 6 - "Community 6"
Cohesion: 0.38
Nodes (7): Dashboard Layout (Sidebar wrapper), DashboardHeader Component, Role-Based Access Control (admin/viewer), Sidebar Component, Supabase Browser Client Factory, Supabase Browser Singleton, Supabase Server Client Factory

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (6): Admin Activity from Edit Logs, renderJsonDiff (field-level diff viewer), Edit Logs Page (Audit Trail), Edit Logs Pagination (offset-based), Holiday Edit Log writes, Supabase Table: edit_logs

### Community 8 - "Community 8"
Cohesion: 0.6
Nodes (4): check(), load_env(), main(), Simulate an ADMS fingerprint scanner pushing data to the local dev server.  Ru

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (2): Holidays Page (CRUD + year overview), Supabase Table: holidays

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (2): Admin Change Password, Profile Page (change password)

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): ConfirmDialog Component, EditModal Component

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (1): Next.js Type References

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (1): Root Page (redirect to dashboard)

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (1): DataTable Component

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (1): StatCard Component

## Knowledge Gaps
- **29 isolated node(s):** `Next.js Type References`, `POLL the latest sorted by time eTimeTrackLite .mdb file in the repo root and syn`, `Return the set of existing values for `column` (paged).`, `Return rows for `table` with the given select columns + optional filter (paged).`, `Insert NEW employees only. Existing employees are fully owned by Supabase —` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (2 nodes): `Holidays Page (CRUD + year overview)`, `Supabase Table: holidays`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (2 nodes): `Admin Change Password`, `Profile Page (change password)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `ConfirmDialog Component`, `EditModal Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `Next.js Type References`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `Root Page (redirect to dashboard)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `DataTable Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `StatCard Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Next.js Type References`, `POLL the latest sorted by time eTimeTrackLite .mdb file in the repo root and syn`, `Return the set of existing values for `column` (paged).` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._