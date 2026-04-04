"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { AttendanceRecord, Employee } from "@/lib/types";
import { formatDate, formatTime, formatDuration } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-8 w-16 rounded bg-gray-200" />
        </div>
        <div className="h-12 w-12 rounded-xl bg-gray-200" />
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 h-5 w-48 rounded bg-gray-200" />
      <div className="h-64 w-full rounded bg-gray-100" />
    </div>
  );
}

interface DeptChartData {
  department: string;
  present: number;
  absent: number;
}

interface DailyTrendData {
  date: string;
  present: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [onLeaveToday, setOnLeaveToday] = useState(0);
  const [lateToday, setLateToday] = useState(0);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [deptChartData, setDeptChartData] = useState<DeptChartData[]>([]);
  const [dailyTrendData, setDailyTrendData] = useState<DailyTrendData[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    try {
      // Total employees
      const { count: empCount } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true });
      setTotalEmployees(empCount ?? 0);

      // Today's attendance
      const { data: todayAttendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("attendance_date", today);

      const todayRecords: AttendanceRecord[] = (todayAttendance ?? []) as AttendanceRecord[];
      setPresentToday(
        todayRecords.filter((r) => r.present === 1 || r.status === "Present")
          .length
      );
      setOnLeaveToday(todayRecords.filter((r) => r.is_on_leave).length);
      setLateToday(
        todayRecords.filter((r) => r.late_by && r.late_by > 0).length
      );

      // Recent 10 records
      const { data: recent } = await supabase
        .from("attendance")
        .select("*")
        .order("attendance_date", { ascending: false })
        .order("in_time", { ascending: false })
        .limit(10);
      setRecentRecords(recent ?? []);

      // Monthly attendance for dept chart
      const { data: monthlyAttendance } = await supabase
        .from("attendance")
        .select("*, employee:employees(department:department(dept_name))")
        .gte("attendance_date", startOfMonth)
        .lte("attendance_date", endOfMonth);

      // Group by department
      const deptMap: Record<string, { present: number; absent: number }> = {};
      (monthlyAttendance ?? []).forEach((rec: any) => {
        const deptName =
          rec.employee?.department?.dept_name ?? "Unknown";
        if (!deptMap[deptName]) deptMap[deptName] = { present: 0, absent: 0 };
        if (rec.present === 1 || rec.status === "Present") {
          deptMap[deptName].present += 1;
        } else {
          deptMap[deptName].absent += 1;
        }
      });
      setDeptChartData(
        Object.entries(deptMap).map(([department, vals]) => ({
          department,
          ...vals,
        }))
      );

      // Daily trend for current month
      const dailyMap: Record<string, number> = {};
      (monthlyAttendance ?? []).forEach((rec: any) => {
        const d = rec.attendance_date;
        if (!dailyMap[d]) dailyMap[d] = 0;
        if (rec.present === 1 || rec.status === "Present") {
          dailyMap[d] += 1;
        }
      });
      const trendData = Object.entries(dailyMap)
        .map(([date, present]) => ({
          date: date.slice(5), // MM-DD
          present,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      setDailyTrendData(trendData);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              title="Total Employees"
              value={totalEmployees}
              color="bg-indigo-100 text-indigo-600"
              icon={
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              }
            />
            <StatCard
              title="Present Today"
              value={presentToday}
              color="bg-green-100 text-green-600"
              icon={
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
            <StatCard
              title="On Leave Today"
              value={onLeaveToday}
              color="bg-amber-100 text-amber-600"
              icon={
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              }
            />
            <StatCard
              title="Late Today"
              value={lateToday}
              color="bg-red-100 text-red-600"
              icon={
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : (
          <>
            {/* Department-wise Attendance */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Department-wise Attendance (This Month)
              </h2>
              {deptChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={deptChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="department"
                      tick={{ fontSize: 12 }}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="present"
                      fill="#6366f1"
                      name="Present"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="absent"
                      fill="#f87171"
                      name="Absent"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-gray-400">
                  No data available
                </p>
              )}
            </div>

            {/* Monthly Attendance Trend */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Monthly Attendance Trend
              </h2>
              {dailyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="present"
                      stroke="#6366f1"
                      strokeWidth={2}
                      name="Present"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-gray-400">
                  No data available
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Recent Attendance Table */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Recent Attendance Records
        </h2>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100" />
            ))}
          </div>
        ) : recentRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">In Time</th>
                  <th className="px-4 py-3 font-medium">Out Time</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Late By</th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      {formatDate(rec.attendance_date)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {rec.employee_name}
                    </td>
                    <td className="px-4 py-3">
                      {rec.in_time ? formatTime(rec.in_time) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {rec.out_time ? formatTime(rec.out_time) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {rec.duration ? formatDuration(rec.duration) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          rec.status === "Present"
                            ? "bg-green-100 text-green-700"
                            : rec.is_on_leave
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {rec.status ?? "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {rec.late_by && rec.late_by > 0
                        ? `${rec.late_by} min`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-gray-400">
            No recent records found
          </p>
        )}
      </div>
    </div>
  );
}
