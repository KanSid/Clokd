"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Holiday } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  PartyPopper,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";

export default function HolidaysPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [form, setForm] = useState({
    holiday_date: "",
    name: "",
    type: "public" as "public" | "optional" | "restricted",
  });
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("holidays")
      .select("*")
      .gte("holiday_date", `${year}-01-01`)
      .lte("holiday_date", `${year}-12-31`)
      .order("holiday_date", { ascending: true });
    setHolidays(data ?? []);
    setLoading(false);
  }, [year]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const openAddModal = () => {
    setEditingHoliday(null);
    setForm({ holiday_date: "", name: "", type: "public" });
    setShowModal(true);
  };

  const openEditModal = (h: Holiday) => {
    setEditingHoliday(h);
    setForm({
      holiday_date: h.holiday_date,
      name: h.name,
      type: h.type,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.holiday_date || !form.name) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (editingHoliday) {
      const { error } = await supabase
        .from("holidays")
        .update({
          holiday_date: form.holiday_date,
          name: form.name,
          type: form.type,
        })
        .eq("id", editingHoliday.id);

      if (!error) {
        await supabase.from("edit_logs").insert({
          edited_by: user?.id,
          editor_email: user?.email,
          table_name: "holidays",
          record_id: String(editingHoliday.id),
          old_value: {
            holiday_date: editingHoliday.holiday_date,
            name: editingHoliday.name,
            type: editingHoliday.type,
          },
          new_value: form,
          action: "update",
        });
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("holidays")
        .insert({
          holiday_date: form.holiday_date,
          name: form.name,
          type: form.type,
          created_by: user?.id,
        })
        .select()
        .single();

      if (!error && inserted) {
        await supabase.from("edit_logs").insert({
          edited_by: user?.id,
          editor_email: user?.email,
          table_name: "holidays",
          record_id: String(inserted.id),
          old_value: null,
          new_value: form,
          action: "insert",
        });
      }
    }

    setSaving(false);
    setShowModal(false);
    fetchHolidays();
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const holiday = holidays.find((h) => h.id === deletingId);

    const { error } = await supabase.from("holidays").delete().eq("id", deletingId);

    if (!error && holiday) {
      await supabase.from("edit_logs").insert({
        edited_by: user?.id,
        editor_email: user?.email,
        table_name: "holidays",
        record_id: String(deletingId),
        old_value: {
          holiday_date: holiday.holiday_date,
          name: holiday.name,
          type: holiday.type,
        },
        new_value: null,
        action: "delete",
      });
    }

    setDeletingId(null);
    fetchHolidays();
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "public":
        return "bg-pink-100 text-pink-700";
      case "optional":
        return "bg-amber-100 text-amber-700";
      case "restricted":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  // Group holidays by month
  const monthGroups = holidays.reduce(
    (acc, h) => {
      const month = new Date(h.holiday_date + "T00:00:00").getMonth();
      if (!acc[month]) acc[month] = [];
      acc[month].push(h);
      return acc;
    },
    {} as Record<number, Holiday[]>
  );

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Mini year calendar showing holiday dots
  const renderYearOverview = () => {
    return (
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {monthNames.map((name, idx) => {
          const monthHolidays = monthGroups[idx] ?? [];
          const daysInMonth = new Date(year, idx + 1, 0).getDate();
          const firstDay = new Date(year, idx, 1).getDay();

          return (
            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
              <h4 className="mb-2 text-xs font-bold text-slate-700">{name}</h4>
              <div className="grid grid-cols-7 gap-px">
                {/* Padding */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`p-${i}`} className="h-4" />
                ))}
                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, d) => {
                  const dateStr = `${year}-${String(idx + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
                  const isHoliday = monthHolidays.some((h) => h.holiday_date === dateStr);
                  const isSunday = new Date(year, idx, d + 1).getDay() === 0;
                  return (
                    <div
                      key={d}
                      className={`flex h-4 w-4 items-center justify-center rounded-sm text-[7px] font-medium ${
                        isHoliday
                          ? "bg-pink-500 text-white"
                          : isSunday
                          ? "bg-slate-200 text-slate-500"
                          : "text-slate-400"
                      }`}
                    >
                      {d + 1}
                    </div>
                  );
                })}
              </div>
              {monthHolidays.length > 0 && (
                <p className="mt-2 text-[10px] text-pink-600 font-medium">
                  {monthHolidays.length} holiday{monthHolidays.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Public Holidays</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage public, optional, and restricted holidays
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700"
        >
          <Plus className="h-4 w-4" /> Add Holiday
        </button>
      </div>

      {/* Year Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setYear(year - 1)}
          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-pink-600" />
          <span className="text-xl font-bold text-slate-900">{year}</span>
        </div>
        <button
          onClick={() => setYear(year + 1)}
          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100"
        >
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
        <span className="ml-2 rounded-full bg-pink-100 px-3 py-1 text-sm font-medium text-pink-700">
          {holidays.length} holidays
        </span>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
        </div>
      ) : (
        <>
          {/* Year Overview Mini Calendar */}
          {renderYearOverview()}

          {/* Holiday List by Month */}
          <div className="space-y-4">
            {Object.entries(monthGroups)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([monthIdx, monthHolidays]) => (
                <div
                  key={monthIdx}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-100 px-6 py-3">
                    <h3 className="font-semibold text-slate-900">
                      {monthNames[Number(monthIdx)]}
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {monthHolidays.map((h) => {
                      const dayOfWeek = new Date(h.holiday_date + "T00:00:00").toLocaleDateString(
                        "en-IN",
                        { weekday: "short" }
                      );

                      return (
                        <div
                          key={h.id}
                          className="flex items-center justify-between px-6 py-3 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-pink-50">
                              <span className="text-lg font-bold text-pink-700">
                                {new Date(h.holiday_date + "T00:00:00").getDate()}
                              </span>
                              <span className="text-[10px] font-medium text-pink-500">
                                {dayOfWeek}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{h.name}</p>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getTypeBadge(h.type)}`}
                              >
                                {h.type}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditModal(h)}
                              className="rounded p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingId(h.id)}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            {holidays.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
                <PartyPopper className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-4 text-lg font-medium text-slate-500">No holidays set for {year}</p>
                <p className="mt-1 text-sm text-slate-400">
                  Click &quot;Add Holiday&quot; to add public holidays
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingHoliday ? "Edit Holiday" : "Add Holiday"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Date
                </label>
                <input
                  type="date"
                  value={form.holiday_date}
                  onChange={(e) => setForm({ ...form, holiday_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Holiday Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 focus:outline-none"
                  placeholder="e.g. Republic Day"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as "public" | "optional" | "restricted" })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 focus:outline-none"
                >
                  <option value="public">Public Holiday</option>
                  <option value="optional">Optional Holiday</option>
                  <option value="restricted">Restricted Holiday</option>
                </select>
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
                disabled={saving || !form.holiday_date || !form.name}
                className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingHoliday ? "Update" : "Add Holiday"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Holiday</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to remove this holiday?
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
