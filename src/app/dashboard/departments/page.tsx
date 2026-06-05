"use client";

import { useEffect, useState, useCallback, Suspense, lazy } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Department, Employee, AttendanceRecord } from "@/lib/types";
import {
  Building2,
  Users,
  Clock,
  Timer,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";

// Lazy load all recharts components
const BarChart = dynamic(() => import("recharts").then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then(m => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import("recharts").then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then(m => m.Cell), { ssr: false });

interface DeptStats {
  totalPresent: number;
  avgAttendance: number;
  totalLate: number;
  totalOvertime: number;
}

interface DeptWithStats extends Department {
  stats: DeptStats;
  employees: (Employee & {
    present: number;
    late: number;
    overtime: number;
  })[];
}

const PIE_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DeptWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDept, setExpandedDept] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ dept_name: "", staff_count: 0 });

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    // 3 parallel queries instead of 2N+1 sequential
    const [{ data: depts }, { data: allEmployees }, { data: allAttendance }] =
      await Promise.all([
        supabase.from("department").select("*").order("dept_name"),
        supabase.from("employees").select("*"),
        supabase
          .from("attendance")
          .select("*")
          .gte("attendance_date", monthStart)
          .lte("attendance_date", monthEnd),
      ]);

    if (!depts) {
      setLoading(false);
      return;
    }

    const employees: Employee[] = allEmployees || [];
    const attendance: AttendanceRecord[] = allAttendance || [];

    const deptsWithStats: DeptWithStats[] = depts.map((dept) => {
      const deptEmployees = employees.filter(
        (e) => e.department_id === dept.department_id
      );
      const empIds = new Set(deptEmployees.map((e) => e.employee_id));
      const attendanceRecords = attendance.filter((a) =>
        empIds.has(a.employee_id)
      );

      const totalPresent = attendanceRecords.reduce(
        (sum, a) => sum + (a.present || 0),
        0
      );
      const workingDays = new Set(
        attendanceRecords.map((a) => a.attendance_date)
      ).size;
      const avgAttendance =
        empIds.size > 0 && workingDays > 0
          ? (totalPresent / (empIds.size * workingDays)) * 100
          : 0;
      const totalLate = attendanceRecords.filter(
        (a) => a.late_by && a.late_by > 0
      ).length;
      const totalOvertime = attendanceRecords.reduce(
        (sum, a) => sum + (a.overtime || 0),
        0
      );

      const employeesWithStats = deptEmployees.map((emp) => {
        const empAtt = attendanceRecords.filter(
          (a) => a.employee_id === emp.employee_id
        );
        return {
          ...emp,
          present: empAtt.reduce((s, a) => s + (a.present || 0), 0),
          late: empAtt.filter((a) => a.late_by && a.late_by > 0).length,
          overtime: empAtt.reduce((s, a) => s + (a.overtime || 0), 0),
        };
      });

      return {
        ...dept,
        stats: {
          totalPresent: Math.round(totalPresent * 10) / 10,
          avgAttendance: Math.round(avgAttendance * 10) / 10,
          totalLate,
          totalOvertime,
        },
        employees: employeesWithStats,
      };
    });

    setDepartments(deptsWithStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleSave = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (editingDept) {
      const oldValue = {
        dept_name: editingDept.dept_name,
        staff_count: editingDept.staff_count,
      };
      const { error } = await supabase
        .from("department")
        .update(formData)
        .eq("department_id", editingDept.department_id);

      if (!error) {
        await supabase.from("edit_logs").insert({
          edited_by: user?.id,
          editor_email: user?.email,
          table_name: "department",
          record_id: String(editingDept.department_id),
          old_value: oldValue,
          new_value: formData,
          action: "update",
        });
      }
    } else {
      const { data, error } = await supabase
        .from("department")
        .insert(formData)
        .select()
        .single();

      if (!error && data) {
        await supabase.from("edit_logs").insert({
          edited_by: user?.id,
          editor_email: user?.email,
          table_name: "department",
          record_id: String(data.department_id),
          old_value: null,
          new_value: formData,
          action: "insert",
        });
      }
    }

    setShowModal(false);
    setEditingDept(null);
    setFormData({ dept_name: "", staff_count: 0 });
    fetchDepartments();
  };

  const handleDelete = async (dept: Department) => {
    if (!confirm(`Delete department "${dept.dept_name}"?`)) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("department")
      .delete()
      .eq("department_id", dept.department_id);

    if (!error) {
      await supabase.from("edit_logs").insert({
        edited_by: user?.id,
        editor_email: user?.email,
        table_name: "department",
        record_id: String(dept.department_id),
        old_value: {
          dept_name: dept.dept_name,
          staff_count: dept.staff_count,
        },
        new_value: null,
        action: "delete",
      });
      fetchDepartments();
    }
  };

  const openEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormData({
      dept_name: dept.dept_name,
      staff_count: dept.staff_count,
    });
    setShowModal(true);
  };

  const openAdd = () => {
    setEditingDept(null);
    setFormData({ dept_name: "", staff_count: 0 });
    setShowModal(true);
  };

  const barChartData = departments.map((d) => ({
    name: d.dept_name,
    "Avg Attendance %": d.stats.avgAttendance,
    "Late Instances": d.stats.totalLate,
  }));

  const pieData = departments.map((d) => ({
    name: d.dept_name,
    value: d.staff_count,
  }));

  return (
    <div className="space-y-8">
      {/* Header — always renders immediately (LCP element) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-500 mt-1">
            Manage departments and view attendance stats
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-200" />
              <div className="space-y-1">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-200" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-16 rounded-lg bg-gray-100" />
              ))}
            </div>
          </div>
        ))}
        {departments.map((dept) => (
          <div
            key={dept.department_id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Building2 className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {dept.dept_name}
                    </h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {dept.staff_count} employees
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(dept)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dept)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600 font-medium">
                    Avg Attendance
                  </p>
                  <p className="text-lg font-bold text-green-700">
                    {dept.stats.avgAttendance}%
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600 font-medium">
                    Present Days
                  </p>
                  <p className="text-lg font-bold text-blue-700">
                    {dept.stats.totalPresent}
                  </p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Late
                  </p>
                  <p className="text-lg font-bold text-amber-700">
                    {dept.stats.totalLate}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    Overtime
                  </p>
                  <p className="text-lg font-bold text-purple-700">
                    {dept.stats.totalOvertime}h
                  </p>
                </div>
              </div>

              <button
                onClick={() =>
                  setExpandedDept(
                    expandedDept === dept.department_id
                      ? null
                      : dept.department_id
                  )
                }
                className="flex items-center gap-1 mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
              >
                {expandedDept === dept.department_id ? (
                  <>
                    <ChevronUp className="w-4 h-4" /> Hide Employees
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" /> View Employees
                  </>
                )}
              </button>
            </div>

            {expandedDept === dept.department_id && (
              <div className="border-t border-gray-100 bg-gray-50 p-4">
                {dept.employees.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No employees in this department
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dept.employees.map((emp) => (
                      <div
                        key={emp.employee_id}
                        className="flex items-center justify-between bg-white rounded-lg p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {emp.employee_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {emp.employee_code} &middot; {emp.designation}
                          </p>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span className="text-green-600 font-medium">
                            {emp.present}d present
                          </span>
                          <span className="text-amber-600 font-medium">
                            {emp.late} late
                          </span>
                          <span className="text-purple-600 font-medium">
                            {emp.overtime}h OT
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts — deferred until after cards render */}
      {!loading && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Department Comparison */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Department Comparison
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="Avg Attendance %"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Late Instances"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Employee Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Employee Distribution
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name} (${value})`}
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingDept ? "Edit Department" : "Add Department"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  value={formData.dept_name}
                  onChange={(e) =>
                    setFormData({ ...formData, dept_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="e.g. Engineering"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Staff Count
                </label>
                <input
                  type="number"
                  value={formData.staff_count}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      staff_count: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  min={0}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                {editingDept ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
