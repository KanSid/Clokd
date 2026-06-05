"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Employee } from "@/lib/types";
import {
  metricsFromRow,
  type MonthlyMetricsRow,
  formatMinutes,
  exportToCSV,
} from "@/lib/utils";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";

type TabKey = "summary" | "department" | "late" | "overtime" | "performance";

interface EmployeeReport {
  employee: Employee;
  empId: string;
  deptName: string;
  totalP: number;
  daysPresent: number;
  daysLeave: number;
  sundaysWorked: number;
  halfDayNormal: number;
  earlyLeaveDays: number; // HD/E (deprecated)
  hdLateDays: number;     // HD/L
  missedPunchDays: number;
  daysOff: number;        // full-day leave + 0.5*half-day + all Sundays in month
  adjLeave: number;       // daysOff + 0.5*HD/L
  lotMinutes: number;     // loss of time (Σ early_by on Present days)
  overtimeMinutes: number;
  overtimeFormatted: string;
  adjOtMinutes: number;   // overtime - LOT
  attendancePct: number;
}

export default function ReportsPage() {
  const router = useRouter();
  const now = new Date();
  // Default to previous month — the current month rarely has complete data yet.
  const defaultDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [year, setYear] = useState(defaultDate.getFullYear());
  const [month, setMonth] = useState(defaultDate.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [dailyLateData, setDailyLateData] = useState<{ date: string; count: number }[]>([]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    // Metrics are computed entirely in the DB (employee_monthly_metrics view).
    // The raw attendance fetch is only for the daily-late-count chart.
    const [{ data: employees }, { data: metricsRows }, { data: lateRows }, { data: departments }] = await Promise.all([
      supabase.from("employees").select("*"),
      supabase.from("employee_monthly_metrics").select("*").eq("year", year).eq("month", month),
      supabase.from("attendance").select("attendance_date, late_by").gte("attendance_date", startDate).lte("attendance_date", endDate),
      supabase.from("department").select("*"),
    ]);

    const deptMap = new Map((departments ?? []).map((d: { department_id: number; dept_name: string }) => [d.department_id, d.dept_name] as [number, string]));
    const metricsMap = new Map((metricsRows ?? []).map((m: MonthlyMetricsRow) => [m.employee_id, m] as [number, MonthlyMetricsRow]));
    const totalDaysInMonth = endDay;

    // All Sundays in the month (calendar) — part of every employee's "days off".
    let sundaysInMonth = 0;
    for (let d = 1; d <= endDay; d++) {
      if (new Date(year, month - 1, d).getDay() === 0) sundaysInMonth++;
    }

    const reportData: EmployeeReport[] = ((employees ?? []) as Employee[]).map((emp) => {
      const empDeptName = (deptMap.get(emp.department_id) ?? "Unknown") as string;
      const metrics = metricsFromRow(metricsMap.get(emp.employee_id));
      const attendancePct = totalDaysInMonth > 0 ? Math.round((metrics.totalWorkingDays / totalDaysInMonth) * 100) : 0;

      // Days off: full-day leave + half-day leave (0.5) + Sundays.
      // STORE (dept 24) works Sundays, so only count the Sundays they were absent
      // (didn't work); every other department counts all Sundays in the month.
      const sundayDaysOff = emp.department_id === 24 ? metrics.sundaysAbsent : sundaysInMonth;
      const daysOff = metrics.totalLeaves + 0.5 * metrics.halfDayNormal + sundayDaysOff;
      // Adjusted leave: days off + HD/L as 0.5 each + weekday MP only
      // (Sunday MPs are already captured in Days Off via the Sunday component)
      const adjLeave = daysOff + 0.5 * metrics.hdLateDays + metrics.missedPunchWeekdays;
      // Adjusted overtime: raw overtime minus loss of time
      const adjOtMinutes = metrics.overtimeMinutes - metrics.lotMinutes;

      return {
        employee: emp,
        empId: emp.emp_id ?? "",
        deptName: empDeptName,
        totalP: metrics.totalP,
        daysPresent: metrics.totalWorkingDays,
        daysLeave: metrics.totalLeaves,
        sundaysWorked: metrics.totalSundaysWorked,
        halfDayNormal: metrics.halfDayNormal,
        earlyLeaveDays: metrics.earlyLeaveDays,
        hdLateDays: metrics.hdLateDays,
        missedPunchDays: metrics.missedPunchDays,
        daysOff,
        adjLeave,
        lotMinutes: metrics.lotMinutes,
        overtimeMinutes: metrics.overtimeMinutes,
        overtimeFormatted: metrics.overtimeFormatted,
        adjOtMinutes,
        attendancePct,
      };
    });

    // --- SORT BY EMP ID (Natural Alphanumeric Order) ---
    reportData.sort((a, b) => a.empId.localeCompare(b.empId, undefined, { numeric: true, sensitivity: 'base' }));

    setReports(reportData);

    // Daily late data
    const dailyMap: Record<string, number> = {};
    ((lateRows ?? []) as { attendance_date: string; late_by: number | null }[]).forEach((rec) => {
      if (rec.late_by && rec.late_by > 0) {
        const d = rec.attendance_date;
        dailyMap[d] = (dailyMap[d] || 0) + 1;
      }
    });
    setDailyLateData(
      Object.entries(dailyMap)
        .map(([date, count]) => ({ date: date.slice(5), count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    );

    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const changeMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

  const handleExport = () => {
    // Mirror the UI grouping: department header row followed by employee rows
    const data: Record<string, unknown>[] = [];
    for (const group of groupedVisible) {
      // Department header row
      data.push({
        "Emp ID": `— ${group.deptName} (${group.emps.length}) —`,
        Name: "",
        MP: "",
        "Days Off": "",
        "HD/L": "",
        "Adj Leave": "",
        "Overtime (HH:MM)": "",
        "LOT (HH:MM)": "",
        "Adj OT (HH:MM)": "",
      });
      // Employee rows
      for (const r of group.emps) {
        data.push({
          "Emp ID": r.empId,
          Name: r.employee.employee_name,
          MP: r.missedPunchDays,
          "Days Off": Math.round(r.daysOff * 10) / 10,
          "HD/L": r.hdLateDays,
          "Adj Leave": Math.round(r.adjLeave * 10) / 10,
          "Overtime (HH:MM)": r.overtimeFormatted,
          "LOT (HH:MM)": formatMinutes(r.lotMinutes),
          "Adj OT (HH:MM)": formatMinutes(r.adjOtMinutes),
        });
      }
    }
    exportToCSV(data, `attendance-report-${year}-${String(month).padStart(2, "0")}.csv`);
  };

  const handleExportDeptReport = (deptName?: string) => {
    const depts = deptName
      ? departmentReports.filter((d) => d.deptName === deptName)
      : departmentReports;

    const rows: Record<string, unknown>[] = [];
    for (const dept of depts) {
      // Department summary row
      rows.push({
        Department: dept.deptName,
        "Emp ID": "",
        Employee: "— DEPARTMENT TOTAL —",
        MP: dept.totalMissedPunch,
        "Days Off": Math.round(dept.totalDaysOff * 10) / 10,
        "HD/L": dept.totalHdLate,
        "Adj Leave": Math.round(dept.totalAdjLeave * 10) / 10,
        "Overtime (HH:MM)": dept.totalOvertimeFormatted,
        "LOT (HH:MM)": formatMinutes(dept.totalLot),
        "Adj OT (HH:MM)": formatMinutes(dept.totalAdjOt),
      });
      // Employee rows
      for (const r of dept.employees) {
        rows.push({
          Department: dept.deptName,
          "Emp ID": r.empId,
          Employee: r.employee.employee_name,
          MP: r.missedPunchDays,
          "Days Off": Math.round(r.daysOff * 10) / 10,
          "HD/L": r.hdLateDays,
          "Adj Leave": Math.round(r.adjLeave * 10) / 10,
          "Overtime (HH:MM)": r.overtimeFormatted,
          "LOT (HH:MM)": formatMinutes(r.lotMinutes),
          "Adj OT (HH:MM)": formatMinutes(r.adjOtMinutes),
        });
      }
    }
    const filename = deptName
      ? `dept-report-${deptName.replace(/\s+/g, "-")}-${year}-${String(month).padStart(2, "0")}.csv`
      : `dept-report-all-${year}-${String(month).padStart(2, "0")}.csv`;
    exportToCSV(rows, filename);
  };

  // Only employees with an emp_id, sorted by it — used for all table/chart rendering.
  // Exclude: deleted employees (del_ prefix in name or id), employees with no
  // activity this month (nothing to show), and employees with unknown department.
  const visibleReports = [...reports]
    .filter((r) => {
      if (!r.empId) return false;
      if (r.empId.startsWith("del_")) return false;
      if (r.employee.employee_name?.startsWith("del_")) return false;
      if (r.deptName === "Unknown") return false;
      return true;
    })
    .sort((a, b) => a.empId.localeCompare(b.empId, undefined, { numeric: true }));

  // Monthly Summary grouped by department (employees stay emp_id-sorted within each)
  const groupedVisible = (() => {
    const map = new Map<string, EmployeeReport[]>();
    for (const r of visibleReports) {
      if (!map.has(r.deptName)) map.set(r.deptName, []);
      map.get(r.deptName)!.push(r);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([deptName, emps]) => ({ deptName, emps }));
  })();

  // Chart data
  const topOvertimeEmployees = [...visibleReports]
    .filter((r) => r.overtimeMinutes > 0)
    .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes)
    .slice(0, 10)
    .map((r) => ({
      name: r.employee.employee_name,
      hours: Math.round((r.overtimeMinutes / 60) * 10) / 10,
    }));

  // Department overtime
  const deptOvertimeMap: Record<string, number> = {};
  visibleReports.forEach((r) => {
    deptOvertimeMap[r.deptName] = (deptOvertimeMap[r.deptName] || 0) + r.overtimeMinutes;
  });
  const deptOvertimeData = Object.entries(deptOvertimeMap).map(([dept, mins]) => ({
    department: dept,
    hours: Math.round((mins / 60) * 10) / 10,
  }));

  // Performance scores
  const performanceData = visibleReports.map((r) => {
    const attScore = r.attendancePct;
    const otScore = Math.min(r.overtimeMinutes / 600, 1) * 100;
    const score = Math.round(attScore * 0.6 + otScore * 0.4);
    return { ...r, performanceScore: Math.min(score, 100) };
  }).sort((a, b) => b.performanceScore - a.performanceScore);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "summary", label: "Monthly Summary" },
    { key: "department", label: "Department Report" },
    { key: "late", label: "Late Trends" },
    { key: "overtime", label: "Overtime Trends" },
    { key: "performance", label: "Employee Performance" },
  ];

  // Department-wise aggregated data
  const departmentReports = (() => {
    const deptGroupMap: Record<string, EmployeeReport[]> = {};
    visibleReports.forEach((r) => {
      if (!deptGroupMap[r.deptName]) deptGroupMap[r.deptName] = [];
      deptGroupMap[r.deptName].push(r);
    });
    return Object.entries(deptGroupMap).map(([deptName, emps]) => {
      const totalP = emps.reduce((s, r) => s + r.totalP, 0);
      const totalPresent = emps.reduce((s, r) => s + r.daysPresent, 0);
      const totalLeave = emps.reduce((s, r) => s + r.daysLeave, 0);
      const totalSundaysWorked = emps.reduce((s, r) => s + r.sundaysWorked, 0);
      const totalHalfDay = emps.reduce((s, r) => s + r.halfDayNormal, 0);
      const totalEarlyLeave = emps.reduce((s, r) => s + r.earlyLeaveDays, 0);
      const totalHdLate = emps.reduce((s, r) => s + r.hdLateDays, 0);
      const totalMissedPunch = emps.reduce((s, r) => s + r.missedPunchDays, 0);
      const totalDaysOff = emps.reduce((s, r) => s + r.daysOff, 0);
      const totalAdjLeave = emps.reduce((s, r) => s + r.adjLeave, 0);
      const totalLot = emps.reduce((s, r) => s + r.lotMinutes, 0);
      const totalOT = emps.reduce((s, r) => s + r.overtimeMinutes, 0);
      const totalAdjOt = emps.reduce((s, r) => s + r.adjOtMinutes, 0);
      const avgAtt = emps.length > 0 ? Math.round(emps.reduce((s, r) => s + r.attendancePct, 0) / emps.length) : 0;
      return {
        deptName,
        employeeCount: emps.length,
        totalP,
        totalPresent,
        totalLeave,
        totalSundaysWorked,
        totalHalfDay,
        totalEarlyLeave,
        totalHdLate,
        totalMissedPunch,
        totalDaysOff,
        totalAdjLeave,
        totalLot,
        totalAdjOt,
        totalOvertimeMinutes: totalOT,
        totalOvertimeFormatted: formatMinutes(totalOT),
        avgAttendance: avgAtt,
        employees: emps, // Stays implicitly sorted by empId within the department grouping!
      };
    }).sort((a, b) => a.deptName.localeCompare(b.deptName));
  })();

  // const deptComparisonData = departmentReports.map((d) => ({
  //   department: d.deptName,
  //   "Avg Attendance %": d.avgAttendance,
  //   "Total Leave": d.totalLeave,
  // }));

  // Summary stats (derived from visibleReports so numbers stay consistent with the table)
  const totalPresent = visibleReports.reduce((s, r) => s + r.daysPresent, 0);
  const totalLeaves = visibleReports.reduce((s, r) => s + r.daysLeave, 0);
  const totalSundaysWorked = visibleReports.reduce((s, r) => s + r.sundaysWorked, 0);
  const totalOvertimeHrs = Math.round(visibleReports.reduce((s, r) => s + r.overtimeMinutes, 0) / 60 * 10) / 10;
  const avgAttendance = visibleReports.length > 0 ? Math.round(visibleReports.reduce((s, r) => s + r.attendancePct, 0) / visibleReports.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-3">
        <button onClick={() => changeMonth(-1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100">
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <span className="text-lg font-semibold text-slate-900">{monthName} {year}</span>
        <button onClick={() => changeMonth(1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100">
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
        </div>
      ) : (
        <>
          {/* Monthly Summary */}
          {activeTab === "summary" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Total Present Days</p>
                  <p className="mt-1 text-2xl font-bold text-green-700">{totalPresent}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Avg Attendance</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-700">{avgAttendance}%</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Total Leaves</p>
                  <p className="mt-1 text-2xl font-bold text-red-700">{totalLeaves}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Sundays Worked</p>
                  <p className="mt-1 text-2xl font-bold text-purple-700">{totalSundaysWorked}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Total Overtime</p>
                  <p className="mt-1 text-2xl font-bold text-blue-700">{totalOvertimeHrs}h</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="px-4 py-3 font-medium">Emp ID</th>
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">MP</th>
                      <th className="px-4 py-3 font-medium">Days Off</th>
                      <th className="px-4 py-3 font-medium">HD/L</th>
                      <th className="px-4 py-3 font-medium">Adj Leave</th>
                      <th className="px-4 py-3 font-medium">Overtime</th>
                      <th className="px-4 py-3 font-medium">LOT</th>
                      <th className="px-4 py-3 font-medium">Adj OT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedVisible.map((group) => (
                      <Fragment key={group.deptName}>
                        <tr className="border-b border-slate-200 bg-slate-100">
                          <td colSpan={9} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                            {group.deptName} · {group.emps.length}
                          </td>
                        </tr>
                        {group.emps.map((r) => (
                          <tr
                            key={r.employee.employee_id}
                            className="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer"
                            onClick={() => router.push(`/dashboard/employees/${r.employee.employee_id}?year=${year}&month=${month}`)}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.empId}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{r.employee.employee_name}</td>
                            <td className="px-4 py-3">
                              {r.missedPunchDays > 0 ? <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-bold text-white">{r.missedPunchDays}</span> : "0"}
                            </td>
                            <td className="px-4 py-3 text-rose-600 font-medium">{Math.round(r.daysOff * 10) / 10}</td>
                            <td className="px-4 py-3 text-amber-600">{r.hdLateDays || "0"}</td>
                            <td className="px-4 py-3 text-rose-700 font-semibold">{Math.round(r.adjLeave * 10) / 10}</td>
                            <td className="px-4 py-3 text-blue-600 font-medium">{r.overtimeFormatted}</td>
                            <td className="px-4 py-3 text-teal-600">{formatMinutes(r.lotMinutes)}</td>
                            <td className={`px-4 py-3 font-semibold ${r.adjOtMinutes < 0 ? "text-red-600" : "text-blue-700"}`}>{formatMinutes(r.adjOtMinutes)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Department Report */}
          {activeTab === "department" && (
            <div className="space-y-6">
              {/* Export button */}
              <div className="flex justify-end">
                <button
                  onClick={() => handleExportDeptReport()}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Download className="h-4 w-4" /> Export All Departments
                </button>
              </div>

              {/* Department comparison chart
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Department Comparison</h3>
                {deptComparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={deptComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Avg Attendance %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Total Leave" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-slate-400">No data available</p>
                )}
              </div> */}

              {/* Department summary cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {departmentReports.map((dept) => (
                  <div key={dept.deptName} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <h4 className="text-lg font-semibold text-slate-900">{dept.deptName}</h4>
                      <p className="text-xs text-slate-500">{dept.employeeCount} employees</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-4">
                      <div className="rounded-lg bg-rose-50 p-3">
                        <p className="text-xs font-medium text-rose-600">Days Off</p>
                        <p className="text-lg font-bold text-rose-700">{Math.round(dept.totalDaysOff * 10) / 10}</p>
                      </div>
                      <div className="rounded-lg bg-rose-50 p-3">
                        <p className="text-xs font-medium text-rose-600">Adj Leave</p>
                        <p className="text-lg font-bold text-rose-700">{Math.round(dept.totalAdjLeave * 10) / 10}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 p-3">
                        <p className="text-xs font-medium text-amber-600">HD/L</p>
                        <p className="text-lg font-bold text-amber-700">{dept.totalHdLate}</p>
                      </div>
                      <div className="rounded-lg bg-slate-100 p-3">
                        <p className="text-xs font-medium text-slate-600">Missed Punch</p>
                        <p className="text-lg font-bold text-slate-800">{dept.totalMissedPunch}</p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-3">
                        <p className="text-xs font-medium text-blue-600">Overtime</p>
                        <p className="text-lg font-bold text-blue-700">{dept.totalOvertimeFormatted}</p>
                      </div>
                      <div className="rounded-lg bg-teal-50 p-3">
                        <p className="text-xs font-medium text-teal-600">LOT</p>
                        <p className="text-lg font-bold text-teal-700">{formatMinutes(dept.totalLot)}</p>
                      </div>
                      <div className="rounded-lg bg-indigo-50 p-3">
                        <p className="text-xs font-medium text-indigo-600">Adj OT</p>
                        <p className={`text-lg font-bold ${dept.totalAdjOt < 0 ? "text-red-600" : "text-indigo-700"}`}>{formatMinutes(dept.totalAdjOt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Per-department employee tables */}
              {departmentReports.map((dept) => (
                <div key={dept.deptName} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-4">
                    <h3 className="text-lg font-semibold text-slate-900">{dept.deptName}</h3>
                    <p className="text-xs text-slate-500">{dept.employeeCount} employees &middot; Avg Attendance: {dept.avgAttendance}%</p>
                  </div>
                  <div className="flex items-center gap-2 border-b border-slate-100 px-6 pb-3">
                    <button
                      onClick={() => handleExportDeptReport(dept.deptName)}
                      className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      <Download className="h-3.5 w-3.5" /> Export {dept.deptName}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="px-4 py-3 font-medium">Emp ID</th>
                          <th className="px-4 py-3 font-medium">Employee</th>
                          <th className="px-4 py-3 font-medium">MP</th>
                          <th className="px-4 py-3 font-medium">Days Off</th>
                          <th className="px-4 py-3 font-medium">HD/L</th>
                          <th className="px-4 py-3 font-medium">Adj Leave</th>
                          <th className="px-4 py-3 font-medium">Overtime</th>
                          <th className="px-4 py-3 font-medium">LOT</th>
                          <th className="px-4 py-3 font-medium">Adj OT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dept.employees.map((r) => (
                          <tr
                            key={r.employee.employee_id}
                            className="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer"
                            onClick={() => router.push(`/dashboard/employees/${r.employee.employee_id}?year=${year}&month=${month}`)}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.empId}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{r.employee.employee_name}</td>
                            <td className="px-4 py-3">
                              {r.missedPunchDays > 0 ? <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-bold text-white">{r.missedPunchDays}</span> : "0"}
                            </td>
                            <td className="px-4 py-3 text-rose-600 font-medium">{Math.round(r.daysOff * 10) / 10}</td>
                            <td className="px-4 py-3 text-amber-600">{r.hdLateDays || "0"}</td>
                            <td className="px-4 py-3 text-rose-700 font-semibold">{Math.round(r.adjLeave * 10) / 10}</td>
                            <td className="px-4 py-3 text-blue-600 font-medium">{r.overtimeFormatted}</td>
                            <td className="px-4 py-3 text-teal-600">{formatMinutes(r.lotMinutes)}</td>
                            <td className={`px-4 py-3 font-semibold ${r.adjOtMinutes < 0 ? "text-red-600" : "text-blue-700"}`}>{formatMinutes(r.adjOtMinutes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Late Trends  */}
          {activeTab === "late" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Daily Late Count</h3>
                {dailyLateData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyLateData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} name="Late Count" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-slate-400">No late data available</p>
                )}
              </div>

            </div>
          )}

          {/* Overtime Trends */}
          {activeTab === "overtime" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Top 10 Employees by Overtime</h3>
                {topOvertimeEmployees.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topOvertimeEmployees} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip />
                      <Bar dataKey="hours" fill="#6366f1" name="Overtime Hours" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-slate-400">No overtime data</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Department-wise Overtime</h3>
                {deptOvertimeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={deptOvertimeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="hours" fill="#8b5cf6" name="Overtime Hours" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-slate-400">No overtime data</p>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h3 className="text-lg font-semibold text-slate-900">All Employees with Overtime</h3>
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Overtime (HH:MM)</th>
                      <th className="px-4 py-3 font-medium">Total Minutes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReports.filter((r) => r.overtimeMinutes > 0).length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No overtime records</td></tr>
                    ) : (
                      visibleReports
                        .filter((r) => r.overtimeMinutes > 0)
                        .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes)
                        .map((r) => (
                          <tr
                            key={r.employee.employee_id}
                            className="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer"
                            onClick={() => router.push(`/dashboard/employees/${r.employee.employee_id}?year=${year}&month=${month}`)}
                          >
                            <td className="px-4 py-3 font-medium text-slate-900">{r.employee.employee_name}</td>
                            <td className="px-4 py-3 text-slate-500">{r.deptName}</td>
                            <td className="px-4 py-3 text-blue-600 font-medium">{r.overtimeFormatted}</td>
                            <td className="px-4 py-3">{r.overtimeMinutes}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Employee Performance */}
          {activeTab === "performance" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Attendance %</th>
                    <th className="px-4 py-3 font-medium">LOT</th>
                    <th className="px-4 py-3 font-medium">Overtime</th>
                    <th className="px-4 py-3 font-medium">Adj OT</th>
                    <th className="px-4 py-3 font-medium">Performance Score</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceData.map((r, i) => (
                    <tr
                      key={r.employee.employee_id}
                      className="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer"
                      onClick={() => router.push(`/dashboard/employees/${r.employee.employee_id}?year=${year}&month=${month}`)}
                    >
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{r.employee.employee_name}</td>
                      <td className="px-4 py-3 text-slate-500">{r.deptName}</td>
                      <td className="px-4 py-3">{r.attendancePct}%</td>
                      <td className="px-4 py-3 text-teal-600">{formatMinutes(r.lotMinutes)}</td>
                      <td className="px-4 py-3">{r.overtimeFormatted}</td>
                      <td className={`px-4 py-3 font-medium ${r.adjOtMinutes < 0 ? "text-red-600" : "text-blue-700"}`}>{formatMinutes(r.adjOtMinutes)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${
                                r.performanceScore >= 80 ? "bg-green-500" :
                                r.performanceScore >= 60 ? "bg-amber-500" :
                                "bg-red-500"
                              }`}
                              style={{ width: `${r.performanceScore}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${
                            r.performanceScore >= 80 ? "text-green-600" :
                            r.performanceScore >= 60 ? "text-amber-600" :
                            "text-red-600"
                          }`}>
                            {r.performanceScore}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
