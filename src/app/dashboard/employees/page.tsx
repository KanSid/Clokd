"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Employee, Department } from "@/lib/types";
import { formatTime } from "@/lib/utils";

type EmployeeWithDept = Omit<Employee, 'department'> & {
  department?: { dept_name: string } | null;
};

interface EditModalProps {
  open: boolean;
  onClose: () => void;
  employee: Partial<EmployeeWithDept> | null;
  departments: Department[];
  onSave: (data: Partial<Employee>) => Promise<void>;
  isNew: boolean;
}

function EditModal({
  open,
  onClose,
  employee,
  departments,
  onSave,
  isNew,
}: EditModalProps) {
  const [form, setForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        employee_name: employee.employee_name ?? "",
        employee_code: employee.employee_code ?? "",
        department_id: employee.department_id ?? undefined,
        designation: employee.designation ?? "",
        status: employee.status ?? "Active",
        in_time: employee.in_time ?? "",
        out_time: employee.out_time ?? "",
      });
    } else {
      setForm({
        employee_name: "",
        employee_code: "",
        department_id: undefined,
        designation: "",
        status: "Active",
        in_time: "",
        out_time: "",
      });
    }
  }, [employee]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          {isNew ? "Add Employee" : "Edit Employee"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              required
              value={form.employee_name ?? ""}
              onChange={(e) =>
                setForm({ ...form, employee_name: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Employee Code
            </label>
            <input
              type="text"
              required
              value={form.employee_code ?? ""}
              onChange={(e) =>
                setForm({ ...form, employee_code: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Department
            </label>
            <select
              value={form.department_id ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  department_id: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.department_id} value={dept.department_id}>
                  {dept.dept_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Designation
            </label>
            <input
              type="text"
              value={form.designation ?? ""}
              onChange={(e) =>
                setForm({ ...form, designation: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              value={form.status ?? "Active"}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Expected In Time
              </label>
              <input
                type="time"
                value={form.in_time ?? ""}
                onChange={(e) =>
                  setForm({ ...form, in_time: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Expected Out Time
              </label>
              <input
                type="time"
                value={form.out_time ?? ""}
                onChange={(e) =>
                  setForm({ ...form, out_time: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  message,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="mb-6 text-sm text-gray-700">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeWithDept[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] =
    useState<EmployeeWithDept | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  async function fetchEmployees() {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees_filt")
      .select("*, department:department(dept_name)")
      .order("department_id", { ascending: true });

    if (!error && data) {
      setEmployees(data as EmployeeWithDept[]);
    }
    setLoading(false);
  }

  async function fetchDepartments() {
    const { data } = await supabase
      .from("department")
      .select("*")
      .order("dept_name");
    if (data) setDepartments(data);
  }

  const filteredEmployees = useMemo(() => {
    let filtered = employees;

    // Filter by department
    if (selectedDept) {
      filtered = filtered.filter(
        (emp) => String(emp.department_id) === selectedDept
      );
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (emp) =>
          emp.employee_name?.toLowerCase().includes(q) ||
          emp.employee_code?.toLowerCase().includes(q) ||
          emp.designation?.toLowerCase().includes(q) ||
          emp.department?.dept_name?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [employees, search, selectedDept]);

  async function handleSave(data: Partial<Employee>) {
    if (isNew) {
      const { data: inserted, error } = await supabase
        .from("employees")
        .insert(data)
        .select()
        .single();

      if (!error && inserted) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("edit_logs").insert({
          edited_by: user?.id,
          editor_email: user?.email,
          table_name: "employees",
          record_id: String(inserted.employee_id),
          old_value: null,
          new_value: inserted,
          action: "insert",
        });
      }
    } else if (editingEmployee) {
      // Fetch old values
      const { data: oldRecord } = await supabase
        .from("employees")
        .select("*")
        .eq("employee_id", editingEmployee.employee_id)
        .single();

      const { error } = await supabase
        .from("employees")
        .update(data)
        .eq("employee_id", editingEmployee.employee_id);

      if (!error) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("edit_logs").insert({
          edited_by: user?.id,
          editor_email: user?.email,
          table_name: "employees",
          record_id: String(editingEmployee.employee_id),
          old_value: oldRecord,
          new_value: data,
          action: "update",
        });
      }
    }
    fetchEmployees();
  }

  async function handleDelete() {
    if (!deletingId) return;

    const { data: oldRecord } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_id", deletingId)
      .single();

    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("employee_id", deletingId);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("edit_logs").insert({
        edited_by: user?.id,
        editor_email: user?.email,
        table_name: "employees",
        record_id: String(deletingId),
        old_value: oldRecord,
        new_value: null,
        action: "delete",
      });
    }

    setConfirmOpen(false);
    setDeletingId(null);
    fetchEmployees();
  }

  function openAddModal() {
    setIsNew(true);
    setEditingEmployee(null);
    setEditModalOpen(true);
  }

  function openEditModal(emp: EmployeeWithDept) {
    setIsNew(false);
    setEditingEmployee(emp);
    setEditModalOpen(true);
  }

  function openDeleteConfirm(id: number) {
    setDeletingId(id);
    setConfirmOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
        <button
          onClick={openAddModal}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Add Employee
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-md flex-1">
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          />
        </div>
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.department_id} value={dept.department_id}>
              {dept.dept_name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="animate-pulse space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100" />
            ))}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
              {/* <th className="px-4 py-3 font-medium">ID</th> */}
                <th className="px-4 py-3 font-medium">Employee Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Department</th>
                {/* <th className="px-4 py-3 font-medium">Designation</th> */}
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Expected In</th>
                <th className="px-4 py-3 font-medium">Expected Out</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No employees found
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.employee_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                  { /* <td className="px-4 py-3 text-gray-500">
                      {emp.employee_id}
                    </td>*/}
                    <td className="px-4 py-3">{emp.employee_code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {emp.employee_name}
                    </td>
                    <td className="px-4 py-3">
                      {emp.department?.dept_name ?? "-"}
                    </td>
                    {/* <td className="px-4 py-3">{emp.designation ?? "-"}</td> */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          emp.status === "Active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {emp.in_time ? formatTime(emp.in_time) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {emp.out_time ? formatTime(emp.out_time) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {/* Edit */}
                        <button
                          onClick={() => openEditModal(emp)}
                          className="rounded p-1 text-indigo-600 hover:bg-indigo-50"
                          title="Edit"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                        {/* View */}
                        <button
                          onClick={() =>
                            router.push(
                              `/dashboard/employees/${emp.employee_id}`
                            )
                          }
                          className="rounded p-1 text-gray-500 hover:bg-gray-100"
                          title="View"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => openDeleteConfirm(emp.employee_id)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          title="Delete"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <EditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        employee={editingEmployee}
        departments={departments}
        onSave={handleSave}
        isNew={isNew}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setDeletingId(null);
        }}
        onConfirm={handleDelete}
        message="Are you sure you want to delete this employee? This action cannot be undone."
      />
    </div>
  );
}
