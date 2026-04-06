"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { AttendanceRecord, Department } from "@/lib/types";
import { formatTime, formatDate, formatDuration, formatMinutes } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Users,
  UserCheck,
  Clock,
  X,
} from "lucide-react";

export default function AttendancePage() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useState(today);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState({
    employee_id: "",
    attendance_date: today,
    in_time: "",
    out_time: "",
    status: "Present",
    is_on_leave: false,
  });
  const [saving, setSaving] = useState(false);

  // Confirm delete
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("attendance")
      .select("*")
      .eq("attendance_date", selectedDate)
      .order("employee_name", { ascending: true });

    const { data } = await query;
    setRecords(data ?? []);
    setLoading(false);
  }, [selectedDate]);

  const fetchDepartments = useCallback(async () => {
    const { data } = await supabase.from("department").select("*").order("dept_name");
    setDepartments(data ?? []);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Filter records
  const filteredRecords = records.filter((rec) => {
    const matchesSearch = !search.trim() ||
      rec.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      rec.employee_code?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const presentCount = records.filter((r) => r.present && r.present > 0 && !r.is_on_leave).length;
  const leaveCount = records.filter((r) => r.is_on_leave).length;
  const lateCount = records.filter((r) => r.late_by && r.late_by > 10).length;
  const earlyLeaveCount = records.filter((r) => r.early_by && r.early_by > 10).length;

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    if (d > new Date()) return;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setForm({
      employee_id: "",
      attendance_date: selectedDate,
      in_time: "",
      out_time: "",
      status: "Present",
      is_on_leave: false,
    });
    setShowModal(true);
  };

  const openEditModal = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setForm({
      employee_id: String(rec.employee_id),
      attendance_date: rec.attendance_date,
      in_time: rec.in_time ? rec.in_time.slice(0, 16) : "",
      out_time: rec.out_time ? rec.out_time.slice(0, 16) : "",
      status: rec.status ?? "Present",
      is_on_leave: rec.is_on_leave ?? false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (editingRecord) {
      // Update
      const { data: oldRec } = await supabase
        .from("attendance")
        .select("*")
        .eq("id", editingRecord.id)
        .single();

      const updateData: Record<string, unknown> = {
        status: form.status,
        is_on_leave: form.is_on_leave,
      };
      if (form.in_time) updateData.in_time = form.in_time;
      if (form.out_time) updateData.out_time = form.out_time;

      const { error } = await supabase
        .from("attendance")
        .update(updateData)
        .eq("id", editingRecord.id);

      if (!error) {
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
    } else {
      // Check for existing record (prevent duplicates)
      const { data: existing } = await supabase
        .from("attendance")
        .select("id")
        .eq("employee_id", Number(form.employee_id))
        .eq("attendance_date", form.attendance_date)
        .maybeSingle();

      if (existing) {
        alert(`An attendance record already exists for this employee on ${form.attendance_date}. Please edit the existing record instead.`);
        setSaving(false);
        return;
      }

      // Insert
      const insertData = {
        employee_id: Number(form.employee_id),
        attendance_date: form.attendance_date,
        in_time: form.in_time || null,
        out_time: form.out_time || null,
        status: form.status,
        is_on_leave: form.is_on_leave,
        present: form.is_on_leave ? 0 : 1,
        absent: form.is_on_leave ? 1 : 0,
      };

      const { data: inserted, error } = await supabase
        .from("attendance")
        .insert(insertData)
        .select()
        .single();

      if (!error && inserted) {
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
    setShowModal(false);
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

  const dateObj = new Date(selectedDate + "T00:00:00");
  const dateDisplay = dateObj.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900">Attendance Records</h1>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Add Record
        </button>
      </div>

      {/* Date Navigation & Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
          <button onClick={() => changeDate(-1)} className="rounded p-1 hover:bg-slate-100">
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => {
              if (e.target.value <= today) setSelectedDate(e.target.value);
            }}
            className="border-0 bg-transparent px-2 py-1 text-sm font-medium text-slate-900 focus:outline-none"
          />
          <button onClick={() => changeDate(1)} disabled={selectedDate >= today} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>
        <p className="text-sm text-slate-500">{dateDisplay}</p>
        <div className="ml-auto flex gap-3">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.department_id} value={d.department_id}>{d.dept_name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Users className="h-5 w-5" />
            <span className="text-xs font-medium">Total Records</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900">{records.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-green-600">
            <UserCheck className="h-5 w-5" />
            <span className="text-xs font-medium">Present</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-700">{presentCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-red-600">
            <Users className="h-5 w-5" />
            <span className="text-xs font-medium">On Leave</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-red-700">{leaveCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600">
            <Clock className="h-5 w-5" />
            <span className="text-xs font-medium">Late</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-700">{lateCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-teal-600">
            <Clock className="h-5 w-5" />
            <span className="text-xs font-medium">Left Early</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-teal-700">{earlyLeaveCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="animate-pulse space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-slate-100" />
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <p className="py-12 text-center text-slate-400">No attendance records for this date</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Code</th>
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
              {filteredRecords.map((rec) => (
                <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{rec.employee_name}</td>
                  <td className="px-4 py-3 text-slate-500">{rec.employee_code}</td>
                  <td className="px-4 py-3">{formatTime(rec.in_time)}</td>
                  <td className="px-4 py-3">{formatTime(rec.out_time)}</td>
                  <td className="px-4 py-3">{formatDuration(rec.duration)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      rec.is_on_leave ? "bg-red-100 text-red-700" :
                      rec.present && rec.present > 0 ? "bg-green-100 text-green-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {rec.is_on_leave ? "Leave" : rec.status ?? "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {rec.late_by && rec.late_by > 0 ? (
                      <span className="font-medium text-amber-600">{rec.late_by}m</span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {rec.early_by && rec.early_by > 0 ? (
                      <span className="font-medium text-teal-600">{rec.early_by}m</span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {rec.overtime && rec.overtime > 0 ? (
                      <span className="font-medium text-blue-600">{formatMinutes(rec.overtime)}</span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(rec)}
                        className="rounded p-1 text-indigo-600 hover:bg-indigo-50"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingId(rec.id)}
                        className="rounded p-1 text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingRecord ? "Edit Attendance" : "Add Attendance Record"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {!editingRecord && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Employee ID</label>
                  <input
                    type="number"
                    value={form.employee_id}
                    onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Enter employee ID"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                <input
                  type="date"
                  value={form.attendance_date}
                  onChange={(e) => setForm({ ...form, attendance_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">In Time</label>
                  <input
                    type="datetime-local"
                    value={form.in_time}
                    onChange={(e) => setForm({ ...form, in_time: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Out Time</label>
                  <input
                    type="datetime-local"
                    value={form.out_time}
                    onChange={(e) => setForm({ ...form, out_time: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <input
                  type="text"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="modal_leave"
                  checked={form.is_on_leave}
                  onChange={(e) => setForm({ ...form, is_on_leave: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="modal_leave" className="text-sm font-medium text-slate-700">On Leave</label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Record</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this attendance record? This action will be logged.
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
