"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import type { AttendanceRecord, Department } from "@/lib/types";
import { formatTime, formatDate } from "@/lib/utils";
import { Laptop, Trash2, X, Search, Check } from "lucide-react";

const WORK_MODE = "WFH";

// WFH is recorded as a standard 10:00-19:00 working day (no manual time entry).
// The whole system stores IST wall-clock time labelled as UTC (e.g. 10:00 IST is
// stored as 2026-07-01 10:00:00+00) and the metrics trigger reads it back with
// `AT TIME ZONE 'UTC'`, so we append +00:00 to store the clock time verbatim
// regardless of the DB server timezone.
const WFH_IN_TIME = "10:00:00";
const WFH_OUT_TIME = "19:00:00";
// Kept off the `adms:%` namespace so the punch self-heal / auto-roster logic
// never overwrites a manually-set WFH day.
const WFH_SOURCE = "manual:wfh";

interface EmployeeOption {
  employee_id: number;
  employee_name: string | null;
  employee_code: string | null;
  emp_id: string | null;
  department_id: number | null;
  status: string | null;
}

export default function WorkFromHomePage() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [empSearch, setEmpSearch] = useState("");
  const [empOpen, setEmpOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    attendance_date: today,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase
      .from("employees")
      .select("employee_id, employee_name, employee_code, emp_id, department_id, status")
      .order("employee_name");
    setEmployees(
      (data ?? []).filter(
        (e) => e.status === "Working" && !(e.employee_name ?? "").startsWith("del_"),
      ),
    );
  }, []);

  const fetchDepartments = useCallback(async () => {
    const { data } = await supabase.from("department").select("*").order("dept_name");
    setDepartments(data ?? []);
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("work_mode", WORK_MODE)
      .order("attendance_date", { ascending: false })
      .limit(200);
    setRecords(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
    fetchRecords();
  }, [fetchEmployees, fetchDepartments, fetchRecords]);

  const empById = useMemo(() => {
    const m: Record<number, EmployeeOption> = {};
    for (const e of employees) m[e.employee_id] = e;
    return m;
  }, [employees]);

  const deptNameById = (id: number | null | undefined) =>
    departments.find((d) => d.department_id === id)?.dept_name ?? "";

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        (e.employee_name ?? "").toLowerCase().includes(q) ||
        (e.employee_code ?? "").toLowerCase().includes(q) ||
        (e.emp_id ?? "").toLowerCase().includes(q),
    );
  }, [employees, empSearch]);

  const nameOf = (rec: AttendanceRecord) =>
    empById[rec.employee_id]?.employee_name ?? rec.employee_name ?? `#${rec.employee_id}`;
  const empIdOf = (rec: AttendanceRecord) => empById[rec.employee_id]?.emp_id ?? "";

  const empLabel = (e: EmployeeOption) =>
    `${e.employee_name ?? ""}${e.emp_id ? ` (${e.emp_id})` : e.employee_code ? ` (${e.employee_code})` : ""}`;

  const selectEmployee = (e: EmployeeOption) => {
    setForm((f) => ({ ...f, employee_id: String(e.employee_id) }));
    setEmpSearch(empLabel(e));
    setEmpOpen(false);
  };

  const handleSave = async () => {
    setMessage(null);
    if (!form.employee_id) {
      setMessage({ kind: "err", text: "Please select an employee." });
      return;
    }
    if (!form.attendance_date) {
      setMessage({ kind: "err", text: "Please pick a date." });
      return;
    }
    setSaving(true);

    const employeeId = Number(form.employee_id);

    // WFH values written to the attendance row. Seed status_code='P' so the
    // metrics trigger runs the normal late/early/overtime rules (its guard
    // skips rows whose status_code isn't P/WOP); the trigger recomputes
    // duration/late/overtime from the fixed 10:00-19:00 times.
    const wfhValues = {
      in_time: `${form.attendance_date}T${WFH_IN_TIME}+00:00`,
      out_time: `${form.attendance_date}T${WFH_OUT_TIME}+00:00`,
      status: "Present",
      status_code: "P",
      is_on_leave: false,
      leave_type: null,
      present: 1,
      absent: 0,
      missed_in_punch: false,
      missed_out_punch: false,
      work_mode: WORK_MODE,
      source_db: WFH_SOURCE,
    };

    // There's one attendance row per employee per day. The nightly roster job
    // fills no-punch days with an auto Absent row, so a WFH day almost always
    // already has a row — update it in place rather than rejecting.
    const { data: existing } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("attendance_date", form.attendance_date)
      .maybeSingle();

    const { data: { user } } = await supabase.auth.getUser();

    if (existing) {
      const { error } = await supabase
        .from("attendance")
        .update(wfhValues)
        .eq("id", existing.id);

      if (error) {
        setSaving(false);
        setMessage({ kind: "err", text: `Could not save: ${error.message}` });
        return;
      }

      await supabase.from("edit_logs").insert({
        edited_by: user?.id,
        editor_email: user?.email,
        table_name: "attendance",
        record_id: String(existing.id),
        old_value: existing,
        new_value: wfhValues,
        action: "update",
      });
    } else {
      const insertData = {
        employee_id: employeeId,
        attendance_date: form.attendance_date,
        ...wfhValues,
      };

      const { data: inserted, error } = await supabase
        .from("attendance")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        setSaving(false);
        setMessage({ kind: "err", text: `Could not save: ${error.message}` });
        return;
      }

      if (inserted) {
        await supabase.from("edit_logs").insert({
          edited_by: user?.id,
          editor_email: user?.email,
          table_name: "attendance",
          record_id: String(inserted.id),
          old_value: null,
          new_value: insertData,
          action: "insert",
        });
      }
    }

    setSaving(false);
    setForm({ employee_id: "", attendance_date: form.attendance_date });
    setEmpSearch("");
    setEmpOpen(false);
    setMessage({ kind: "ok", text: "Work From Home record saved." });
    fetchRecords();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: oldRec } = await supabase
      .from("attendance")
      .select("*")
      .eq("id", deletingId)
      .single();

    const { error } = await supabase.from("attendance").delete().eq("id", deletingId);
    if (!error) {
      await supabase.from("edit_logs").insert({
        edited_by: user?.id,
        editor_email: user?.email,
        table_name: "attendance",
        record_id: String(deletingId),
        old_value: oldRec,
        new_value: null,
        action: "delete",
      });
    }
    setDeletingId(null);
    fetchRecords();
  };

  const selectedEmp = form.employee_id ? empById[Number(form.employee_id)] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Laptop className="h-8 w-8 text-indigo-500" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Work From Home</h1>
          <p className="text-sm text-slate-500">
            Mark an employee as working from home. Counts as Present; late / overtime are
            computed from the times you enter, same as an office day.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add form */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Add WFH Record</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Employee</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => {
                    setEmpSearch(e.target.value);
                    setForm((f) => ({ ...f, employee_id: "" }));
                    setEmpOpen(true);
                  }}
                  onFocus={() => setEmpOpen(true)}
                  placeholder="Search by name, code or ID..."
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-9 text-sm focus:border-indigo-500 focus:outline-none"
                />
                {selectedEmp && !empOpen && (
                  <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600" />
                )}
                {empOpen && (
                  <>
                    {/* click-away layer */}
                    <div className="fixed inset-0 z-10" onClick={() => setEmpOpen(false)} />
                    <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {filteredEmployees.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-slate-400">No matching employees</li>
                      ) : (
                        filteredEmployees.slice(0, 50).map((e) => (
                          <li key={e.employee_id}>
                            <button
                              type="button"
                              // onMouseDown (not onClick) so selection fires before the
                              // input's blur closes the dropdown.
                              onMouseDown={(ev) => {
                                ev.preventDefault();
                                selectEmployee(e);
                              }}
                              className={`flex w-full flex-col items-start px-3 py-2 text-left hover:bg-indigo-50 ${
                                String(e.employee_id) === form.employee_id ? "bg-indigo-50" : ""
                              }`}
                            >
                              <span className="text-sm font-medium text-slate-800">{e.employee_name}</span>
                              <span className="text-xs text-slate-400">
                                {e.emp_id ? e.emp_id : e.employee_code ?? ""}
                                {deptNameById(e.department_id) ? ` · ${deptNameById(e.department_id)}` : ""}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                value={form.attendance_date}
                max={today}
                onChange={(e) => setForm({ ...form, attendance_date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Recorded as a standard <span className="font-medium text-slate-700">10:00 AM - 7:00 PM</span> working
              day. If a record already exists for this day (e.g. an auto-marked absence), it is
              updated to Work From Home.
            </p>

            {message && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.kind === "ok"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save WFH Record"}
            </button>
          </div>
        </div>

        {/* Recent WFH records */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent WFH Records</h2>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-slate-100" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <p className="py-12 text-center text-slate-400">No work-from-home records yet</p>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-4 py-2 font-medium">Employee</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">In</th>
                    <th className="px-4 py-2 font-medium">Out</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">
                        {nameOf(rec)}
                        {empIdOf(rec) && (
                          <span className="ml-1 text-xs text-slate-400">({empIdOf(rec)})</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{formatDate(rec.attendance_date)}</td>
                      <td className="px-4 py-2">{formatTime(rec.in_time)}</td>
                      <td className="px-4 py-2">{formatTime(rec.out_time)}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {rec.status ?? rec.status_code ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setDeletingId(rec.id)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Delete WFH Record</h3>
              <button onClick={() => setDeletingId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this work-from-home record? This action will be logged.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
