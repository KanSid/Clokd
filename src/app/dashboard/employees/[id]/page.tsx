"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Employee, AttendanceRecord, Holiday } from "@/lib/types";
import {
  metricsFromRow,
  type MonthlyMetricsRow,
  formatTime,
  formatDate,
  formatDuration,
  formatMinutes,
} from "@/lib/utils";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import {
  ArrowLeft,
  User,
  Clock,
  CalendarDays,
  Timer,
  Sun,
  Pencil,
  LogOut,
  AlertTriangle,
} from "lucide-react";

type EmployeeWithDept = Omit<Employee, 'department'> & {
  department?: { dept_name: string } | null;
};

const ATTENDANCE_STATUS_OPTIONS = [
  { label: "Present",           code: "P"    },
  { label: "Absent",            code: "A"    },
  { label: "Half Day - Late",   code: "HD/L" },
  { label: "Half Day - Early",  code: "HD/E" },
  { label: "Missed Punch",      code: "MP"   },
  { label: "Week Off",          code: "WO"   },
  { label: "Week Off Present",  code: "WOP"  },
  { label: "Half Present",      code: "½P"   },
  { label: "Leave",             code: "L"    },
] as const;

function statusCodeToLabel(code: string | null): string {
  return ATTENDANCE_STATUS_OPTIONS.find((o) => o.code === code)?.label ?? code ?? "";
}

// Half-day *leave* statuses: late/early minutes are not relevant here, so they
// are hidden. HD/L and HD/E are excluded — for those the late/early IS the point.
const HALF_DAY_LEAVE_CODES = ["HD", "½P", "WO½P"];
function isHalfDayLeave(code: string | null | undefined): boolean {
  return HALF_DAY_LEAVE_CODES.includes((code ?? "").trim());
}

function labelToCode(label: string): string {
  return ATTENDANCE_STATUS_OPTIONS.find((o) => o.label === label)?.code ?? label;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const employeeId = Number(params.id);

  const [employee, setEmployee] = useState<EmployeeWithDept | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [metricsRow, setMetricsRow] = useState<MonthlyMetricsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [year, setYear] = useState(() => {
    const y = Number(searchParams.get("year"));
    return y > 2000 ? y : now.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    const m = Number(searchParams.get("month"));
    return m >= 1 && m <= 12 ? m : now.getMonth() + 1;
  });

  // Edit attendance modal state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ in_time: "", out_time: "", statusLabel: "", is_on_leave: false });
  const [saving, setSaving] = useState(false);

  const fetchEmployee = useCallback(async () => {
    const { data } = await supabase
      .from("employees")
      .select("*, department:department(dept_name)")
      .eq("employee_id", employeeId)
      .single();
    if (data) setEmployee(data as EmployeeWithDept);
  }, [employeeId]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const [{ data: attData }, { data: holData }, { data: metricData }] = await Promise.all([
      supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate)
        .order("attendance_date", { ascending: true }),
      supabase
        .from("holidays")
        .select("*")
        .gte("holiday_date", startDate)
        .lte("holiday_date", endDate)
        .order("holiday_date", { ascending: true }),
      // Metrics are computed in the DB (employee_monthly_metrics view).
      supabase
        .from("employee_monthly_metrics")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle(),
    ]);

    setRecords(attData ?? []);
    setHolidays(holData ?? []);
    setMetricsRow((metricData as MonthlyMetricsRow) ?? null);
    setLoading(false);
  }, [employeeId, year, month]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  };

  const metrics = metricsFromRow(metricsRow);

  const openEditAttendance = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setEditForm({
      in_time: rec.in_time ? rec.in_time.slice(0, 16) : "",
      out_time: rec.out_time ? rec.out_time.slice(0, 16) : "",
      statusLabel: statusCodeToLabel(rec.status_code ?? rec.status),
      is_on_leave: rec.is_on_leave ?? false,
    });
  };

  const handleSaveAttendance = async () => {
    if (!editingRecord) return;
    setSaving(true);

    const { data: oldRec } = await supabase
      .from("attendance")
      .select("*")
      .eq("id", editingRecord.id)
      .single();

    const statusCode = labelToCode(editForm.statusLabel);
    const updateData: Record<string, unknown> = {
      status: editForm.statusLabel,
      status_code: statusCode,
      is_on_leave: editForm.is_on_leave,
    };
    if (editForm.in_time) updateData.in_time = editForm.in_time;
    if (editForm.out_time) updateData.out_time = editForm.out_time;

    const { error } = await supabase
      .from("attendance")
      .update(updateData)
      .eq("id", editingRecord.id);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("edit_logs").insert({
        edited_by: user?.id,
        editor_email: user?.email,
        table_name: "attendance",
        record_id: String(editingRecord.id),
        old_value: oldRec,
        new_value: updateData,
        action: "update",
      });
    }

    setSaving(false);
    setEditingRecord(null);
    fetchRecords();
  };

  if (!employee) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.push("/dashboard/employees")}
        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Employees
      </button>

      {/* Employee Info Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
            <User className="h-8 w-8 text-indigo-600" />
          </div>
          <div className="flex-1 space-y-1">
            <h1 className="text-2xl font-bold text-slate-900">{employee.employee_name}</h1>
            <p className="text-sm text-slate-500">
              {employee.emp_id ?? employee.employee_code} &middot; {employee.department?.dept_name ?? "No Dept"} &middot; {employee.designation || "N/A"}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-green-500" />
                Expected In: <strong>{formatTime(employee.in_time)}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-red-500" />
                Expected Out: <strong>{formatTime(employee.out_time)}</strong>
              </span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                employee.status === "Working" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
              }`}>
                {employee.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600">
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs font-medium">Total P</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.totalP}</p>
            <p className="text-xs text-slate-500">present-equivalent</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-green-600">
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs font-medium">Days Present</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.totalWorkingDays}</p>
            <p className="text-xs text-slate-500">days came to work</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-purple-600">
              <Sun className="h-5 w-5" />
              <span className="text-xs font-medium">Sundays Worked</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.totalSundaysWorked}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-red-600">
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs font-medium">Total Leaves</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.totalLeaves}</p>
          </div>
<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-orange-600">
              <Clock className="h-5 w-5" />
              <span className="text-xs font-medium">Half Day</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.halfDayNormal}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-teal-600">
              <LogOut className="h-5 w-5" />
              <span className="text-xs font-medium">LOT</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatMinutes(metrics.lotMinutes)}</p>
            <p className="text-xs text-slate-500">loss of time</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600">
              <Clock className="h-5 w-5" />
              <span className="text-xs font-medium">HD/L</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.hdLateDays}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-xs font-medium">Missed Punch</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.missedPunchDays}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600">
              <Timer className="h-5 w-5" />
              <span className="text-xs font-medium">Overtime</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.overtimeFormatted}</p>
            <p className="text-xs text-slate-500">Adj OT: {formatMinutes(metrics.overtimeMinutes - metrics.lotMinutes)}</p>
          </div>
        </div>
      )}

      {/* Calendar */}
      <AttendanceCalendar
        attendanceRecords={records}
        holidays={holidays}
        year={year}
        month={month}
        employeeInTime={employee.in_time ?? "09:00:00"}
        employeeOutTime={employee.out_time ?? "18:00:00"}
        employeeName={employee.employee_name}
        departmentName={employee.department?.dept_name ?? undefined}
        onMonthChange={handleMonthChange}
      />

      {/* Attendance Records Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Attendance Records — {monthName} {year}
          </h2>
        </div>
        {loading ? (
          <div className="animate-pulse space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-slate-100" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <p className="py-12 text-center text-slate-400">No records found for this month</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">In Time</th>
                  <th className="px-4 py-3 font-medium">Out Time</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Late By</th>
                  <th className="px-4 py-3 font-medium">Early By</th>
                  <th className="px-4 py-3 font-medium">Overtime</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{formatDate(rec.attendance_date)}</td>
                    <td className="px-4 py-3">{formatTime(rec.in_time)}</td>
                    <td className="px-4 py-3">{formatTime(rec.out_time)}</td>
                    <td className="px-4 py-3">{formatDuration(rec.duration)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        rec.is_on_leave
                          ? "bg-red-100 text-red-700"
                          : rec.present && rec.present > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {rec.is_on_leave ? "Leave" : statusCodeToLabel(rec.status_code ?? rec.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isHalfDayLeave(rec.status_code) && rec.late_by && rec.late_by > 0 ? (
                        <span className="text-amber-600 font-medium">{rec.late_by} min</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {!isHalfDayLeave(rec.status_code) && rec.early_by && rec.early_by > 0 ? (
                        <span className="text-teal-600 font-medium">{rec.early_by} min</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {rec.overtime && rec.overtime > 0 ? (
                        <span className="text-blue-600 font-medium">{formatMinutes(rec.overtime)}</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEditAttendance(rec)}
                        className="rounded p-1 text-indigo-600 hover:bg-indigo-50"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Attendance Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Edit Attendance Record</h2>
            <p className="mb-4 text-sm text-slate-500">
              Date: {formatDate(editingRecord.attendance_date)} &middot; ID: {editingRecord.id}
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">In Time</label>
                <input
                  type="datetime-local"
                  value={editForm.in_time}
                  onChange={(e) => setEditForm({ ...editForm, in_time: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Out Time</label>
                <input
                  type="datetime-local"
                  value={editForm.out_time}
                  onChange={(e) => setEditForm({ ...editForm, out_time: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={editForm.statusLabel}
                  onChange={(e) => setEditForm({ ...editForm, statusLabel: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                >
                  <option value="">— Select status —</option>
                  {ATTENDANCE_STATUS_OPTIONS.map((o) => (
                    <option key={o.code} value={o.label}>{o.label} ({o.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_on_leave"
                  checked={editForm.is_on_leave}
                  onChange={(e) => setEditForm({ ...editForm, is_on_leave: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="is_on_leave" className="text-sm font-medium text-slate-700">
                  On Leave
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingRecord(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAttendance}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
