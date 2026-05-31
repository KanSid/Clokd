"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Employee, AttendanceRecord, Holiday } from "@/lib/types";
import {
  calculateEmployeeMetrics,
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
  deptName: string;
  daysPresent: number;
  daysLeave: number;
  sundaysWorked: number;
  earlyLeaveDays: number;
  overtimeMinutes: number;
  overtimeFormatted: string;
  attendancePct: number;
}

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [dailyLateData, setDailyLateData] = useState<{ date: string; count: number }[]>([]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const [{ data: employees }, { data: attendance }, { data: departments }, { data: holidaysData }] = await Promise.all([
      supabase.from("employees").select("*"),
      supabase.from("attendance").select("*").gte("attendance_date", startDate).lte("attendance_date", endDate),
      supabase.from("department").select("*"),
      supabase.from("holidays").select("*").gte("holiday_date", startDate).lte("holiday_date", endDate),
    ]);

    const deptMap = new Map((departments ?? []).map((d: { department_id: number; dept_name: string }) => [d.department_id, d.dept_name] as [number, string]));
    const allRecords = (attendance ?? []) as AttendanceRecord[];
    const monthHolidays = (holidaysData ?? []) as Holiday[];
    const totalDaysInMonth = endDay;

    const reportData: EmployeeReport[] = ((employees ?? []) as Employee[]).map((emp) => {
      const empRecords = allRecords.filter((r) => r.employee_id === emp.employee_id);
      const empDeptName = (deptMap.get(emp.department_id) ?? "Unknown") as string;
      const metrics = calculateEmployeeMetrics(emp, empRecords, year, month, empDeptName, monthHolidays);
      const attendancePct = totalDaysInMonth > 0 ? Math.round((metrics.totalWorkingDays / totalDaysInMonth) * 100) : 0;

      return {
        employee: emp,
        deptName: empDeptName,
        daysPresent: metrics.totalWorkingDays,
        daysLeave: metrics.totalLeaves,
        sundaysWorked: metrics.totalSundaysWorked,
        earlyLeaveDays: metrics.earlyLeaveDays,
        overtimeMinutes: metrics.overtimeMinutes,
        overtimeFormatted: metrics.overtimeFormatted,
        attendancePct,
      };
    });

    setReports(reportData);

    // Daily late data
    const dailyMap: Record<string, number> = {};
    allRecords.forEach((rec) => {
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
    const data = reports.map((r) => ({
      Name: r.employee.employee_name,
      Code: r.employee.employee_code,
      Department: r.deptName,
      "Days Present": r.daysPresent,
      "Days Leave": r.daysLeave,
      "Sundays Worked": r.sundaysWorked,
      "Early Left Days": r.earlyLeaveDays,
      "Overtime (HH:MM)": r.overtimeFormatted,
      "Attendance %": r.attendancePct,
    }));
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
        Employee: "— DEPARTMENT TOTAL —",
        Code: "",
        "Days Present": dept.totalPresent,
        "Days Leave": dept.totalLeave,
        "Sundays Worked": dept.totalSundaysWorked,
        "Early Left Days": dept.totalEarlyLeave,
        "Overtime (HH:MM)": dept.totalOvertimeFormatted,
        "Attendance %": `${dept.avgAttendance}% avg`,
      });
      // Employee rows
      for (const r of dept.employees) {
        rows.push({
          Department: dept.deptName,
          Employee: r.employee.employee_name,
          Code: r.employee.employee_code,
          "Days Present": r.daysPresent,
          "Days Leave": r.daysLeave,
          "Sundays Worked": r.sundaysWorked,

          "Early Left Days": r.earlyLeaveDays,
          "Overtime (HH:MM)": r.overtimeFormatted,
          "Attendance %": `${r.attendancePct}%`,
        });
      }
    }
    const filename = deptName
      ? `dept-report-${deptName.replace(/\s+/g, "-")}-${year}-${String(month).padStart(2, "0")}.csv`
      : `dept-report-all-${year}-${String(month).padStart(2, "0")}.csv`;
    exportToCSV(rows, filename);
  };

  // Chart data
  const topOvertimeEmployees = [...reports]
    .filter((r) => r.overtimeMinutes > 0)
    .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes)
    .slice(0, 10)
    .map((r) => ({
      name: r.employee.employee_name,
      hours: Math.round((r.overtimeMinutes / 60) * 10) / 10,
    }));

  // Department overtime
  const deptOvertimeMap: Record<string, number> = {};
  reports.forEach((r) => {
    deptOvertimeMap[r.deptName] = (deptOvertimeMap[r.deptName] || 0) + r.overtimeMinutes;
  });
  const deptOvertimeData = Object.entries(deptOvertimeMap).map(([dept, mins]) => ({
    department: dept,
    hours: Math.round((mins / 60) * 10) / 10,
  }));

  // Performance scores
  const performanceData = reports.map((r) => {
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
    reports.forEach((r) => {
      if (!deptGroupMap[r.deptName]) deptGroupMap[r.deptName] = [];
      deptGroupMap[r.deptName].push(r);
    });
    return Object.entries(deptGroupMap).map(([deptName, emps]) => {
      const totalPresent = emps.reduce((s, r) => s + r.daysPresent, 0);
      const totalLeave = emps.reduce((s, r) => s + r.daysLeave, 0);
      const totalSundaysWorked = emps.reduce((s, r) => s + r.sundaysWorked, 0);
      const totalEarlyLeave = emps.reduce((s, r) => s + r.earlyLeaveDays, 0);
      const totalOT = emps.reduce((s, r) => s + r.overtimeMinutes, 0);
      const avgAtt = emps.length > 0 ? Math.round(emps.reduce((s, r) => s + r.attendancePct, 0) / emps.length) : 0;
      return {
        deptName,
        employeeCount: emps.length,
        totalPresent,
        totalLeave,
        totalSundaysWorked,
        totalEarlyLeave,
        totalOvertimeMinutes: totalOT,
        totalOvertimeFormatted: formatMinutes(totalOT),
        avgAttendance: avgAtt,
        employees: emps,
      };
    }).sort((a, b) => a.deptName.localeCompare(b.deptName));
  })();

  const deptComparisonData = departmentReports.map((d) => ({
    department: d.deptName,
    "Avg Attendance %": d.avgAttendance,
    "Total Leave": d.totalLeave,
  }));

  // Summary stats
  const totalPresent = reports.reduce((s, r) => s + r.daysPresent, 0);
  const totalLeaves = reports.reduce((s, r) => s + r.daysLeave, 0);
  const totalSundaysWorked = reports.reduce((s, r) => s + r.sundaysWorked, 0);
  const totalOvertimeHrs = Math.round(reports.reduce((s, r) => s + r.overtimeMinutes, 0) / 60 * 10) / 10;
  const avgAttendance = reports.length > 0 ? Math.round(reports.reduce((s, r) => s + r.attendancePct, 0) / reports.length) : 0;

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
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Present</th>
                      <th className="px-4 py-3 font-medium">Leave</th>
                      <th className="px-4 py-3 font-medium">Sun Worked</th>
                      <th className="px-4 py-3 font-medium">Early Left</th>
                      <th className="px-4 py-3 font-medium">Overtime</th>
                      <th className="px-4 py-3 font-medium">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.employee.employee_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{r.employee.employee_name}</td>
                        <td className="px-4 py-3 text-slate-500">{r.deptName}</td>
                        <td className="px-4 py-3 text-green-700 font-medium">{r.daysPresent}</td>
                        <td className="px-4 py-3 text-red-600">{r.daysLeave}</td>
                        <td className="px-4 py-3 text-purple-600 font-medium">{r.sundaysWorked}</td>
                        <td className="px-4 py-3">
                          {r.earlyLeaveDays > 0 ? <span className="text-teal-600 font-medium">{r.earlyLeaveDays}</span> : "0"}
                        </td>
                        <td className="px-4 py-3 text-blue-600 font-medium">{r.overtimeFormatted}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.attendancePct >= 80 ? "bg-green-100 text-green-700" :
                            r.attendancePct >= 60 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {r.attendancePct}%
                          </span>
                        </td>
                      </tr>
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

              {/* Department comparison chart */}
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
              </div>

              {/* Department summary cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {departmentReports.map((dept) => (
                  <div key={dept.deptName} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <h4 className="text-lg font-semibold text-slate-900">{dept.deptName}</h4>
                      <p className="text-xs text-slate-500">{dept.employeeCount} employees</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-4">
                      <div className="rounded-lg bg-green-50 p-3">
                        <p className="text-xs font-medium text-green-600">Avg Attendance</p>
                        <p className="text-lg font-bold text-green-700">{dept.avgAttendance}%</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-3">
                        <p className="text-xs font-medium text-emerald-600">Total Present</p>
                        <p className="text-lg font-bold text-emerald-700">{dept.totalPresent}</p>
                      </div>
                      <div className="rounded-lg bg-rose-50 p-3">
                        <p className="text-xs font-medium text-rose-600">Total Leave</p>
                        <p className="text-lg font-bold text-rose-700">{dept.totalLeave}</p>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-3">
                        <p className="text-xs font-medium text-purple-600">Sun Worked</p>
                        <p className="text-lg font-bold text-purple-700">{dept.totalSundaysWorked}</p>
                      </div>
                      <div className="rounded-lg bg-teal-50 p-3">
                        <p className="text-xs font-medium text-teal-600">Early Left</p>
                        <p className="text-lg font-bold text-teal-700">{dept.totalEarlyLeave}</p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-3">
                        <p className="text-xs font-medium text-blue-600">Overtime</p>
                        <p className="text-lg font-bold text-blue-700">{dept.totalOvertimeFormatted}</p>
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
                          <th className="px-4 py-3 font-medium">Employee</th>
                          <th className="px-4 py-3 font-medium">Present</th>
                          <th className="px-4 py-3 font-medium">Leave</th>
                          <th className="px-4 py-3 font-medium">Sun Worked</th>
                          <th className="px-4 py-3 font-medium">Early Left</th>
                          <th className="px-4 py-3 font-medium">Overtime</th>
                          <th className="px-4 py-3 font-medium">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dept.employees.map((r) => (
                          <tr key={r.employee.employee_id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{r.employee.employee_name}</td>
                            <td className="px-4 py-3 text-green-700 font-medium">{r.daysPresent}</td>
                            <td className="px-4 py-3 text-red-600">{r.daysLeave}</td>
                            <td className="px-4 py-3 text-purple-600 font-medium">{r.sundaysWorked}</td>
                            <td className="px-4 py-3">
                              {r.earlyLeaveDays > 0 ? <span className="text-teal-600 font-medium">{r.earlyLeaveDays}</span> : "0"}
                            </td>
                            <td className="px-4 py-3 text-blue-600 font-medium">{r.overtimeFormatted}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                r.attendancePct >= 80 ? "bg-green-100 text-green-700" :
                                r.attendancePct >= 60 ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {r.attendancePct}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Late Trends */}
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
                    {reports.filter((r) => r.overtimeMinutes > 0).length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No overtime records</td></tr>
                    ) : (
                      reports
                        .filter((r) => r.overtimeMinutes > 0)
                        .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes)
                        .map((r) => (
                          <tr key={r.employee.employee_id} className="border-b border-slate-100 hover:bg-slate-50">
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
                    <th className="px-4 py-3 font-medium">Early Left</th>
                    <th className="px-4 py-3 font-medium">Overtime</th>
                    <th className="px-4 py-3 font-medium">Performance Score</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceData.map((r, i) => (
                    <tr key={r.employee.employee_id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{r.employee.employee_name}</td>
                      <td className="px-4 py-3 text-slate-500">{r.deptName}</td>
                      <td className="px-4 py-3">{r.attendancePct}%</td>
                      <td className="px-4 py-3">
                        {r.earlyLeaveDays > 0 ? <span className="text-teal-600 font-medium">{r.earlyLeaveDays}</span> : "0"}
                      </td>
                      <td className="px-4 py-3">{r.overtimeFormatted}</td>
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
