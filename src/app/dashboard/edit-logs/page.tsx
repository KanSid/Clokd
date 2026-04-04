"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { EditLog } from "@/lib/types";
import { ShieldAlert, ChevronDown, ChevronUp, Search } from "lucide-react";

const PAGE_SIZE = 50;

export default function EditLogsPage() {
  const [logs, setLogs] = useState<EditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Filters
  const [tableFilter, setTableFilter] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);
    const currentOffset = reset ? 0 : offset;

    let query = supabase
      .from("edit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (tableFilter) query = query.eq("table_name", tableFilter);
    if (emailSearch) query = query.ilike("editor_email", `%${emailSearch}%`);
    if (dateFrom) query = query.gte("created_at", dateFrom + "T00:00:00");
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

    const { data } = await query;

    if (reset) {
      setLogs(data ?? []);
      setOffset(PAGE_SIZE);
    } else {
      setLogs((prev) => [...prev, ...(data ?? [])]);
      setOffset(currentOffset + PAGE_SIZE);
    }

    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    setLoading(false);
  }, [offset, tableFilter, emailSearch, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableFilter, emailSearch, dateFrom, dateTo]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "insert":
        return "bg-green-100 text-green-700";
      case "update":
        return "bg-blue-100 text-blue-700";
      case "delete":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const renderJsonDiff = (oldVal: Record<string, unknown> | null, newVal: Record<string, unknown> | null) => {
    if (!oldVal && !newVal) return <p className="text-slate-400">No data</p>;

    const allKeys = new Set([
      ...Object.keys(oldVal ?? {}),
      ...Object.keys(newVal ?? {}),
    ]);

    return (
      <div className="space-y-1 text-xs font-mono">
        {Array.from(allKeys).map((key) => {
          const oldV = oldVal?.[key];
          const newV = newVal?.[key];
          const changed = JSON.stringify(oldV) !== JSON.stringify(newV);

          return (
            <div key={key} className={`flex gap-2 rounded px-2 py-1 ${changed ? "bg-amber-50" : ""}`}>
              <span className="w-32 flex-shrink-0 font-semibold text-slate-600">{key}:</span>
              {oldVal && (
                <span className={`flex-1 ${changed ? "line-through text-red-500" : "text-slate-500"}`}>
                  {JSON.stringify(oldV ?? null)}
                </span>
              )}
              {newVal && changed && (
                <span className="flex-1 text-green-600 font-medium">
                  {JSON.stringify(newV ?? null)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Edit Logs (Audit Trail)</h1>

      {/* Immutable Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
        <div>
          <p className="font-semibold text-indigo-900">Immutable Audit Trail</p>
          <p className="text-sm text-indigo-700">
            Edit logs cannot be modified or deleted. Every change to employees, attendance, and departments
            is permanently recorded here.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Tables</option>
          <option value="employees">Employees</option>
          <option value="attendance">Attendance</option>
          <option value="department">Department</option>
        </select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search editor email..."
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
            className="rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <span>To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading && logs.length === 0 ? (
          <div className="animate-pulse space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-slate-100" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-12 text-center text-slate-400">No edit logs found</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Header */}
            <div className="hidden sm:grid sm:grid-cols-7 gap-4 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
              <span>ID</span>
              <span>Timestamp</span>
              <span>Editor</span>
              <span>Action</span>
              <span>Table</span>
              <span>Record ID</span>
              <span>Changes</span>
            </div>

            {logs.map((log) => (
              <div key={log.id}>
                <div
                  className="grid grid-cols-2 gap-2 px-4 py-3 text-sm hover:bg-slate-50 cursor-pointer sm:grid-cols-7 sm:gap-4"
                  onClick={() => toggleExpand(log.id)}
                >
                  <span className="text-slate-400 font-mono text-xs">{log.id}</span>
                  <span className="text-slate-600 text-xs">
                    {new Date(log.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-slate-700 text-xs truncate">{log.editor_email ?? "Unknown"}</span>
                  <span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getActionBadge(log.action)}`}>
                      {log.action}
                    </span>
                  </span>
                  <span className="text-slate-600 text-xs font-medium">{log.table_name}</span>
                  <span className="text-slate-500 text-xs font-mono">{log.record_id}</span>
                  <span className="flex items-center gap-1 text-xs text-indigo-600">
                    {expandedIds.has(log.id) ? (
                      <>
                        <ChevronUp className="h-3 w-3" /> Hide
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" /> View
                      </>
                    )}
                  </span>
                </div>

                {/* Expanded Diff View */}
                {expandedIds.has(log.id) && (
                  <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-xs font-semibold text-red-600 uppercase tracking-wide">
                          Old Values
                        </h4>
                        <div className="rounded-lg border border-red-100 bg-white p-3">
                          {log.old_value ? (
                            <pre className="text-xs text-slate-600 whitespace-pre-wrap break-all">
                              {JSON.stringify(log.old_value, null, 2)}
                            </pre>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No previous values (new record)</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-semibold text-green-600 uppercase tracking-wide">
                          New Values
                        </h4>
                        <div className="rounded-lg border border-green-100 bg-white p-3">
                          {log.new_value ? (
                            <pre className="text-xs text-slate-600 whitespace-pre-wrap break-all">
                              {JSON.stringify(log.new_value, null, 2)}
                            </pre>
                          ) : (
                            <p className="text-xs text-slate-400 italic">Record deleted</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Inline diff */}
                    {log.old_value && log.new_value && (
                      <div className="mt-4">
                        <h4 className="mb-2 text-xs font-semibold text-amber-600 uppercase tracking-wide">
                          Field Changes
                        </h4>
                        <div className="rounded-lg border border-amber-100 bg-white p-3">
                          {renderJsonDiff(log.old_value, log.new_value)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && logs.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-4 text-center">
            <button
              onClick={() => fetchLogs(false)}
              disabled={loading}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
