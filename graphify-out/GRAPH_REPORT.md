# Graph Report - .  (2026-06-04)

## Corpus Check
- 33 files · ~24,559 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 109 nodes · 129 edges · 15 communities detected
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `main()` - 9 edges
2. `Supabase` - 7 edges
3. `sync_attendance()` - 7 edges
4. `rows_to_dicts()` - 6 edges
5. `sync_employees()` - 6 edges
6. `sync_holidays()` - 5 edges
7. `sync_departments()` - 4 edges
8. `Middleware Auth & Role Guard` - 4 edges
9. `API Route: Admin Users (GET/DELETE)` - 4 edges
10. `Sidebar Component` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Content Security Policy (CSP)` --conceptually_related_to--> `Supabase SSR Client in Middleware`  [INFERRED]
  next.config.ts → src/middleware.ts
- `Admin Change Password` --semantically_similar_to--> `Profile Page (change password)`  [INFERRED] [semantically similar]
  src/app/dashboard/admin/page.tsx → src/app/dashboard/profile/page.tsx
- `ConfirmDialog Component` --semantically_similar_to--> `EditModal Component`  [INFERRED] [semantically similar]
  src/components/ConfirmDialog.tsx → src/components/EditModal.tsx
- `Supabase Browser Client Factory` --semantically_similar_to--> `Supabase Server Client Factory`  [INFERRED] [semantically similar]
  src/lib/supabase/client.ts → src/lib/supabase/server.ts
- `Sidebar Component` --shares_data_with--> `DashboardHeader Component`  [INFERRED]
  src/app/dashboard/layout.tsx → src/components/DashboardHeader.tsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (3): fetchEmployees(), handleDelete(), handleSave()

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (16): _coerce_date(), _coerce_dt(), connect_mdb(), latest_mdb(), load_env(), main(), Poll the eTimeTrackLite .mdb file in data_in/ and sync to Supabase.  Reads:   -, Return the set of existing values for `column` (paged). (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (14): Admin Panel Page, Admin User Management (create/delete users), Supabase Admin Client (service_role), API Route: Admin Users (GET/DELETE), API Route: Auth Callback (OAuth code exchange), Supabase Server Client (@/lib/supabase/server), Login Page (email/password), Middleware Auth & Role Guard (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.21
Nodes (5): extractHoursMinutes(), formatMinutes(), formatTime(), metricsFromRow(), timeToMinutes()

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (0): 

### Community 5 - "Community 5"
Cohesion: 0.38
Nodes (7): Dashboard Layout (Sidebar wrapper), DashboardHeader Component, Role-Based Access Control (admin/viewer), Sidebar Component, Supabase Browser Client Factory, Supabase Browser Singleton, Supabase Server Client Factory

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (6): Admin Activity from Edit Logs, renderJsonDiff (field-level diff viewer), Edit Logs Page (Audit Trail), Edit Logs Pagination (offset-based), Holiday Edit Log writes, Supabase Table: edit_logs

### Community 7 - "Community 7"
Cohesion: 1.0
Nodes (2): Holidays Page (CRUD + year overview), Supabase Table: holidays

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (2): Admin Change Password, Profile Page (change password)

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (2): ConfirmDialog Component, EditModal Component

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (1): Next.js Type References

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (1): Root App Layout

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (1): Root Page (redirect to dashboard)

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (1): DataTable Component

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (1): StatCard Component

## Knowledge Gaps
- **27 isolated node(s):** `Next.js Type References`, `Security Headers Config`, `Poll the eTimeTrackLite .mdb file in data_in/ and sync to Supabase.  Reads:   -`, `Return the set of existing values for `column` (paged).`, `Insert NEW employees only. Existing employees are fully owned by Supabase —` (+22 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 7`** (2 nodes): `Holidays Page (CRUD + year overview)`, `Supabase Table: holidays`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (2 nodes): `Admin Change Password`, `Profile Page (change password)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (2 nodes): `ConfirmDialog Component`, `EditModal Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (1 nodes): `Next.js Type References`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (1 nodes): `Root App Layout`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `Root Page (redirect to dashboard)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `DataTable Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `StatCard Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Next.js Type References`, `Security Headers Config`, `Poll the eTimeTrackLite .mdb file in data_in/ and sync to Supabase.  Reads:   -` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._