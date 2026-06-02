"""Poll the eTimeTrackLite .mdb file in data_in/ and sync to Supabase.

Reads:
  - Departments  -> public.department
  - Employees    -> public.employees
  - AttendanceLogs -> public.attendance  (delete-then-insert per date range)
  - Holidays     -> public.holidays      (best-effort)

Env (loaded from .env.local at repo root):
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Run via scripts/poll_attendance.bat (or `python scripts/poll_attendance.py`).
Requires: pyodbc, requests. Driver: "Microsoft Access Driver (*.mdb, *.accdb)".
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from datetime import datetime, date, time
from pathlib import Path
from typing import Any

import pyodbc
import requests

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT 
ENV_FILE = ROOT / ".env.local"

BATCH = 500
TIMEOUT = 60


def load_env() -> tuple[str, str]:
    if not ENV_FILE.exists():
        sys.exit(f"missing {ENV_FILE}")
    env: dict[str, str] = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return url.rstrip("/"), key


def latest_mdb() -> Path:
    files = sorted(
        list(DATA_DIR.glob("*.mdb")) + list(DATA_DIR.glob("*.accdb")),
        key=lambda p: p.stat().st_mtime,
    )
    if not files:
        sys.exit(f"no .mdb/.accdb file found in {DATA_DIR}")
    return files[-1]


def connect_mdb(path: Path) -> pyodbc.Connection:
    return pyodbc.connect(
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=" + str(path) + ";"
    )


def to_jsonable(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, time):
        return v.isoformat()
    if isinstance(v, (bytes, bytearray)):
        return None
    return v


def rows_to_dicts(cur: pyodbc.Cursor) -> list[dict[str, Any]]:
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, [to_jsonable(v) for v in r])) for r in cur.fetchall()]


class Supabase:
    def __init__(self, url: str, key: str) -> None:
        self.base = f"{url}/rest/v1"
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> int:
        if not rows:
            return 0
        total = 0
        url = f"{self.base}/{table}?on_conflict={on_conflict}"
        h = {**self.headers, "Prefer": "resolution=merge-duplicates,return=minimal"}
        for i in range(0, len(rows), BATCH):
            chunk = rows[i : i + BATCH]
            r = requests.post(url, headers=h, data=json.dumps(chunk), timeout=TIMEOUT)
            if r.status_code >= 300:
                sys.exit(f"upsert {table} failed [{r.status_code}]: {r.text[:500]}")
            total += len(chunk)
        return total

    def delete_range(self, table: str, column: str, start: str, end: str) -> None:
        url = f"{self.base}/{table}?{column}=gte.{start}&{column}=lte.{end}"
        h = {**self.headers, "Prefer": "return=minimal"}
        r = requests.delete(url, headers=h, timeout=TIMEOUT)
        if r.status_code >= 300:
            sys.exit(f"delete {table} failed [{r.status_code}]: {r.text[:500]}")

    def insert(self, table: str, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        total = 0
        url = f"{self.base}/{table}"
        h = {**self.headers, "Prefer": "return=minimal"}
        for i in range(0, len(rows), BATCH):
            chunk = rows[i : i + BATCH]
            r = requests.post(url, headers=h, data=json.dumps(chunk), timeout=TIMEOUT)
            if r.status_code >= 300:
                sys.exit(f"insert {table} failed [{r.status_code}]: {r.text[:500]}")
            total += len(chunk)
        return total

    def get_id_set(self, table: str, column: str) -> set[Any]:
        """Return the set of existing values for `column` (paged)."""
        ids: set[Any] = set()
        url = f"{self.base}/{table}?select={column}"
        offset = 0
        while True:
            h = {
                **self.headers,
                "Range-Unit": "items",
                "Range": f"{offset}-{offset + BATCH - 1}",
            }
            r = requests.get(url, headers=h, timeout=TIMEOUT)
            if r.status_code >= 300:
                sys.exit(f"select {table} failed [{r.status_code}]: {r.text[:500]}")
            chunk = r.json()
            for row in chunk:
                if row.get(column) is not None:
                    ids.add(row[column])
            if len(chunk) < BATCH:
                break
            offset += BATCH
        return ids


def sync_departments(cur: pyodbc.Cursor, sb: Supabase) -> int:
    cur.execute(
        "SELECT d.DepartmentId, d.DepartmentFName, "
        "(SELECT COUNT(*) FROM Employees e WHERE e.DepartmentId = d.DepartmentId AND (e.RecordStatus IS NULL OR e.RecordStatus <> 0)) AS staff_count "
        "FROM Departments d WHERE d.RecordStatus IS NULL OR d.RecordStatus <> 0"
    )
    rows = []
    for r in rows_to_dicts(cur):
        rows.append(
            {
                "department_id": r["DepartmentId"],
                "dept_name": r["DepartmentFName"],
                "staff_count": int(r["staff_count"] or 0),
            }
        )
    return sb.upsert("department", rows, on_conflict="department_id")


def sync_employees(cur: pyodbc.Cursor, sb: Supabase) -> int:
    """Insert NEW employees only. Existing employees are fully owned by Supabase —
    the machine never overwrites their name, department, or any other field."""
    cur.execute(
        "SELECT EmployeeId, EmployeeName, EmployeeCode, DepartmentId, Designation, Status "
        "FROM Employees WHERE RecordStatus IS NULL OR RecordStatus <> 0"
    )
    existing = sb.get_id_set("employees", "employee_id")
    now_iso = datetime.utcnow().isoformat() + "Z"
    rows = []
    for r in rows_to_dicts(cur):
        if r["EmployeeId"] in existing:
            continue  # already in Supabase → leave it untouched
        rows.append(
            {
                "employee_id": r["EmployeeId"],
                "employee_name": r["EmployeeName"],
                "employee_code": r["EmployeeCode"],
                "department_id": r["DepartmentId"],
                "designation": r["Designation"],
                "status": r["Status"],
                "synced_at": now_iso,
            }
        )
    return sb.insert("employees", rows)


def _coerce_dt(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, str):
        return v
    return None


def _coerce_date(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, str):
        return v[:10]
    return None


def sync_attendance(
    cur: pyodbc.Cursor,
    sb: Supabase,
    source_db: str,
    start_date: str | None = None,
    end_date: str | None = None,
) -> int:
    # Pull only the raw inputs + the machine's classification seed. Derived metrics
    # (Duration, LateBy, EarlyBy, OverTime, ShiftId) are recomputed by the DB trigger,
    # and the employee name/code are resolved from Supabase via employee_id — so none
    # of those are pulled here.
    sql = (
        "SELECT a.attendancelogid, a.AttendanceDate, a.EmployeeId, "
        "a.InTime, a.OutTime, "
        "a.IsOnLeave, a.LeaveType, a.Status, a.StatusCode, "
        "a.Present, a.Absent, a.PunchRecords, "
        "a.MissedInPunch, a.MissedOutPunch "
        "FROM AttendanceLogs a"
    )
    params: list[Any] = []
    if start_date and end_date:
        sql += " WHERE a.AttendanceDate >= ? AND a.AttendanceDate <= ?"
        params = [start_date, end_date]
    cur.execute(sql, *params) if params else cur.execute(sql)
    raw = rows_to_dicts(cur)
    if not raw:
        if start_date and end_date:
            print(f"  attendance window: {start_date} .. {end_date} (0 rows in mdb)")
            sb.delete_range("attendance", "attendance_date", start_date, end_date)
        return 0

    polled_at = datetime.utcnow().isoformat() + "Z"
    rows = []
    dates = []
    for r in raw:
        d = _coerce_date(r["AttendanceDate"])
        if not d:
            continue
        dates.append(d)
        rows.append(
            {
                "attendance_log_id": r["attendancelogid"],
                "attendance_date": d,
                "employee_id": r["EmployeeId"],
                "in_time": _coerce_dt(r["InTime"]),
                "out_time": _coerce_dt(r["OutTime"]),
                "is_on_leave": bool(r["IsOnLeave"]) if r["IsOnLeave"] is not None else False,
                "leave_type": r["LeaveType"],
                "status": r["Status"],
                "status_code": r["StatusCode"],
                "present": r["Present"],
                "absent": r["Absent"],
                "punch_records": r["PunchRecords"],
                "missed_in_punch": bool(r["MissedInPunch"]) if r["MissedInPunch"] is not None else None,
                "missed_out_punch": bool(r["MissedOutPunch"]) if r["MissedOutPunch"] is not None else None,
                "source_db": source_db,
                "polled_at": polled_at,
            }
        )

    start = start_date or min(dates)
    end = end_date or max(dates)
    print(f"  attendance window: {start} .. {end} ({len(rows)} rows)")
    sb.delete_range("attendance", "attendance_date", start, end)
    return sb.insert("attendance", rows)


def sync_holidays(cur: pyodbc.Cursor, sb: Supabase) -> int:
    try:
        cur.execute("SELECT HolidayDate, HolidayName FROM Holidays")
    except pyodbc.Error:
        return 0
    rows = []
    seen: set[str] = set()
    for r in rows_to_dicts(cur):
        d = _coerce_date(r.get("HolidayDate"))
        name = r.get("HolidayName")
        if not d or not name or d in seen:
            continue
        seen.add(d)
        rows.append({"holiday_date": d, "name": name, "type": "public"})
    return sb.upsert("holidays", rows, on_conflict="holiday_date")


def _validate_date(s: str) -> str:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date().isoformat()
    except ValueError:
        raise argparse.ArgumentTypeError(f"invalid date {s!r}, expected YYYY-MM-DD")


def main() -> None:
    p = argparse.ArgumentParser(description="Poll eTimeTrackLite mdb -> Supabase")
    p.add_argument("--start", type=_validate_date, help="start date YYYY-MM-DD (inclusive)")
    p.add_argument("--end", type=_validate_date, help="end date YYYY-MM-DD (inclusive)")
    p.add_argument("--skip-employees", action="store_true", help="only sync attendance")
    args = p.parse_args()

    if bool(args.start) ^ bool(args.end):
        sys.exit("--start and --end must be provided together")
    if args.start and args.end and args.start > args.end:
        sys.exit("--start must be on or before --end")

    url, key = load_env()
    sb = Supabase(url, key)
    mdb = latest_mdb()
    print(f"source: {mdb.name}")
    if args.start:
        print(f"range : {args.start} .. {args.end}")
    else:
        print("range : (full mdb)")

    conn = connect_mdb(mdb)
    cur = conn.cursor()
    try:
        if not args.skip_employees:
            n = sync_departments(cur, sb)
            print(f"departments upserted: {n}")
            n = sync_employees(cur, sb)
            print(f"new employees inserted: {n}")
        n = sync_attendance(cur, sb, source_db=mdb.name, start_date=args.start, end_date=args.end)
        print(f"attendance inserted: {n}")
        if not args.skip_employees:
            n = sync_holidays(cur, sb)
            print(f"holidays upserted: {n}")
    finally:
        cur.close()
        conn.close()
    print("done.")


if __name__ == "__main__":
    main()
