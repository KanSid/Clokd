# Graph Report - .  (2026-04-11)

## Corpus Check
- Corpus is ~22,426 words - fits in a single context window. You may not need a graph.

## Summary
- 181 nodes · 226 edges · 26 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `Supabase Browser Client (@/lib/supabase/client)` - 10 edges
2. `calculateEmployeeMetrics()` - 9 edges
3. `Employees Page (CRUD)` - 8 edges
4. `Shared Type Definitions (@/lib/types)` - 8 edges
5. `timeToMinutes()` - 7 edges
6. `calculateEarlyLeaveDays()` - 7 edges
7. `Dashboard Overview Page` - 7 edges
8. `Employee Detail Page (monthly view)` - 7 edges
9. `Supabase Table: edit_logs` - 7 edges
10. `Utility Functions (@/lib/utils)` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Next.js Wordmark Logo SVG` --conceptually_related_to--> `Next.js Project README`  [INFERRED]
  public/next.svg → README.md
- `Vercel Triangle Logo SVG` --conceptually_related_to--> `Next.js Project README`  [INFERRED]
  public/vercel.svg → README.md
- `DayDetailModal Component` --calls--> `formatDuration()`  [EXTRACTED]
  src/components/DayDetailModal.tsx → src\lib\utils.ts
- `calculateEmployeeMetrics()` --references--> `EmployeeMetrics Interface`  [EXTRACTED]
  src\lib\utils.ts → src/lib/types.ts
- `calculateEmployeeMetrics()` --references--> `Holiday Interface`  [EXTRACTED]
  src\lib\utils.ts → src/lib/types.ts

## Hyperedges (group relationships)
- **Immutable Audit Trail: all CRUD mutations write to edit_logs** — attendance_edit_log, departments_edit_log, employees_edit_log, holidays_edit_log, employee_detail_edit_log, supabase_table_edit_logs, edit_log_pattern [EXTRACTED 0.95]
- **RBAC: middleware + profiles table + admin-only routes** — middleware_auth_guard, middleware_role_check, supabase_table_profiles, admin_page, unauthorized_page [EXTRACTED 0.95]
- **Employee Monthly Detail: metrics + calendar + attendance records + holidays** — employee_detail_page, employee_detail_metrics, attendance_calendar_component, supabase_table_attendance, supabase_table_holidays, lib_utils [EXTRACTED 0.90]
- **Attendance Time Calculation Pipeline** — utils_timetominutes, utils_calculatelatedays, utils_calculateovertime, utils_calculateearlyleavedays, utils_calculateemployeemetrics [EXTRACTED 0.95]
- **Modal/Dialog UI Pattern** — confirmdialog_component, editmodal_component, daydetailmodal_component [INFERRED 0.85]
- **Supabase Auth & Profile Loading Flow** — supabaseclient_createclient, supabaseserver_createclient, sidebar_component, dashboardheader_component, rbac_admin_viewer [INFERRED 0.80]

## Communities

### Community 0 - "Attendance Calendar Core"
Cohesion: 0.06
Nodes (5): fetchAllUsers(), fetchEmployees(), handleCreateUser(), handleDelete(), handleSave()

### Community 1 - "Shared UI Components & Utilities"
Cohesion: 0.13
Nodes (25): ConfirmDialog Component, CSV Injection Protection Pattern, DayDetailModal Component, EditModal Component, Store Department Sunday Timing Rule (11:00-18:00), AttendanceRecord Interface, DayInfo Interface, DayStatus Union Type (+17 more)

### Community 2 - "Employee Detail & Auth Pages"
Cohesion: 0.12
Nodes (28): Admin Change Password, Root Page (redirect to dashboard), AttendanceCalendar Component, DayStatus Computation Logic, Store Department Sunday Override Logic, calculateEarlyByForRecord call (Attendance), Attendance Records Page (CRUD), fetchDashboardData (Supabase queries) (+20 more)

### Community 3 - "Calendar Status Helpers"
Cohesion: 0.15
Nodes (0): 

### Community 4 - "Admin & Auth API"
Cohesion: 0.14
Nodes (14): Admin Panel Page, Admin User Management (create/delete users), Supabase Admin Client (service_role), API Route: Admin Users (GET/DELETE), API Route: Auth Callback (OAuth code exchange), Supabase Server Client (@/lib/supabase/server), Login Page (email/password), Middleware Auth & Role Guard (+6 more)

### Community 5 - "Audit Trail / Edit Logs"
Cohesion: 0.25
Nodes (11): Admin Activity from Edit Logs, Attendance Edit Log writes, Department Edit Log writes, Audit Trail Pattern (edit_logs insert on every mutation), renderJsonDiff (field-level diff viewer), Edit Logs Page (Audit Trail), Edit Logs Pagination (offset-based), Employee Detail Attendance Edit Log writes (+3 more)

### Community 6 - "Supabase Client Layer"
Cohesion: 0.2
Nodes (0): 

### Community 7 - "Middleware & Server Routes"
Cohesion: 0.33
Nodes (4): createAdminClient(), DELETE(), GET(), getAuthenticatedUser()

### Community 8 - "Layout & Navigation Shell"
Cohesion: 0.38
Nodes (7): Dashboard Layout (Sidebar wrapper), DashboardHeader Component, Role-Based Access Control (admin/viewer), Sidebar Component, Supabase Browser Client Factory, Supabase Browser Singleton, Supabase Server Client Factory

### Community 9 - "Next.js / Vercel Infrastructure"
Cohesion: 0.5
Nodes (4): Next.js Breaking Changes Warning, Next.js Wordmark Logo SVG, Vercel Triangle Logo SVG, Next.js Project README

### Community 10 - "Edit Modal Logic"
Cohesion: 0.67
Nodes (0): 

### Community 11 - "Confirm Dialog"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Sortable Data Table"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Next.js Type Declarations"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Security Headers Config"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "StatCard File"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Next.js Type References"
Cohesion: 1.0
Nodes (1): Next.js Type References

### Community 17 - "Root App Layout"
Cohesion: 1.0
Nodes (1): Root App Layout

### Community 18 - "Calendar Usage"
Cohesion: 1.0
Nodes (1): AttendanceCalendar usage

### Community 19 - "DataTable Component"
Cohesion: 1.0
Nodes (1): DataTable Component

### Community 20 - "StatCard Component"
Cohesion: 1.0
Nodes (1): StatCard Component

### Community 21 - "EditLog Type"
Cohesion: 1.0
Nodes (1): EditLog Interface

### Community 22 - "Claude/Graphify Config"
Cohesion: 1.0
Nodes (1): Graphify Knowledge Graph Rules

### Community 23 - "File Icon SVG"
Cohesion: 1.0
Nodes (1): File Document Icon SVG

### Community 24 - "Globe Icon SVG"
Cohesion: 1.0
Nodes (1): Globe/World Icon SVG

### Community 25 - "Browser Window Icon SVG"
Cohesion: 1.0
Nodes (1): Browser Window Icon SVG

## Knowledge Gaps
- **36 isolated node(s):** `Next.js Type References`, `Security Headers Config`, `Root App Layout`, `Root Page (redirect to dashboard)`, `Supabase Admin Client (service_role)` (+31 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Confirm Dialog`** (2 nodes): `ConfirmDialog.tsx`, `ConfirmDialog()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sortable Data Table`** (2 nodes): `DataTable.tsx`, `handleSort()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Type Declarations`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Security Headers Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `StatCard File`** (1 nodes): `StatCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Type References`** (1 nodes): `Next.js Type References`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root App Layout`** (1 nodes): `Root App Layout`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Calendar Usage`** (1 nodes): `AttendanceCalendar usage`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DataTable Component`** (1 nodes): `DataTable Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `StatCard Component`** (1 nodes): `StatCard Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `EditLog Type`** (1 nodes): `EditLog Interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Claude/Graphify Config`** (1 nodes): `Graphify Knowledge Graph Rules`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Icon SVG`** (1 nodes): `File Document Icon SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Globe Icon SVG`** (1 nodes): `Globe/World Icon SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Browser Window Icon SVG`** (1 nodes): `Browser Window Icon SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Supabase Browser Client (@/lib/supabase/client)` connect `Employee Detail & Auth Pages` to `Admin & Auth API`, `Audit Trail / Edit Logs`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `Edit Logs Page (Audit Trail)` connect `Audit Trail / Edit Logs` to `Employee Detail & Auth Pages`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `Next.js Type References`, `Security Headers Config`, `Root App Layout` to the rest of the system?**
  _36 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Attendance Calendar Core` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Shared UI Components & Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Employee Detail & Auth Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Admin & Auth API` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._