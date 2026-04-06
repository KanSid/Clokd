"use client";

import type { DayInfo } from "@/lib/types";
import { formatTime, formatDuration, formatMinutes } from "@/lib/utils";
import {
  X,
  Clock,
  LogIn,
  LogOut,
  Timer,
  AlertTriangle,
  CalendarOff,
  PartyPopper,
  Sun,
} from "lucide-react";

interface DayDetailModalProps {
  dayInfo: DayInfo;
  employeeInTime: string;
  employeeOutTime: string;
  departmentName?: string;
  onClose: () => void;
}

function extractTimeFromTimestamp(timestamp: string): { hours: number; minutes: number } {
  const timePart = timestamp.split(/[T ]/)[1];
  if (!timePart) return { hours: 0, minutes: 0 };
  const parts = timePart.split(":");
  return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
}

function parseTimeStr(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(":");
  return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
}

export default function DayDetailModal({
  dayInfo,
  employeeInTime,
  employeeOutTime,
  departmentName,
  onClose,
}: DayDetailModalProps) {
  const { date, status, record, holiday, isLate, isOvertime, isEarlyLeave, isHalfDay, isSunday } = dayInfo;
  const rec = record;

  // Store department has different Sunday timings: 11:00 - 18:00
  const isStoreDept = departmentName?.toLowerCase() === "store";
  const effectiveInTime = isSunday && isStoreDept ? "11:00:00" : employeeInTime;
  const effectiveOutTime = isSunday && isStoreDept ? "18:00:00" : employeeOutTime;

  const dateDisplay = date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Calculate late minutes
  let lateMinutes = 0;
  if (isLate && rec?.in_time) {
    const actualIn = extractTimeFromTimestamp(rec.in_time);
    const expectedIn = parseTimeStr(effectiveInTime);
    lateMinutes = (actualIn.hours * 60 + actualIn.minutes) - (expectedIn.hours * 60 + expectedIn.minutes);
  }

  // Calculate early leave minutes
  let earlyLeaveMinutes = 0;
  if (isEarlyLeave && rec?.out_time) {
    const actualOut = extractTimeFromTimestamp(rec.out_time);
    const expectedOut = parseTimeStr(effectiveOutTime);
    earlyLeaveMinutes = (expectedOut.hours * 60 + expectedOut.minutes) - (actualOut.hours * 60 + actualOut.minutes);
  }

  // Calculate overtime minutes
  let overtimeMinutes = 0;
  if (isOvertime && rec?.out_time) {
    const actualOut = extractTimeFromTimestamp(rec.out_time);
    const expectedOut = parseTimeStr(effectiveOutTime);
    overtimeMinutes = (actualOut.hours * 60 + actualOut.minutes) - (expectedOut.hours * 60 + expectedOut.minutes);
  }

  const getStatusBadge = () => {
    const badges: { label: string; color: string; icon: React.ReactNode }[] = [];

    if (holiday) {
      badges.push({
        label: `Holiday: ${holiday.name}`,
        color: "bg-pink-100 text-pink-800",
        icon: <PartyPopper className="h-3.5 w-3.5" />,
      });
    }

    if (isSunday) {
      badges.push({
        label: "Sunday",
        color: "bg-slate-100 text-slate-700",
        icon: <Sun className="h-3.5 w-3.5" />,
      });
    }

    switch (status) {
      case "present":
      case "overtime":
        badges.push({ label: "Present", color: "bg-emerald-100 text-emerald-800", icon: <Clock className="h-3.5 w-3.5" /> });
        break;
      case "absent":
        badges.push({ label: "Leave", color: "bg-rose-100 text-rose-800", icon: <CalendarOff className="h-3.5 w-3.5" /> });
        break;
      case "leave":
        badges.push({ label: rec?.leave_type || "On Leave", color: "bg-rose-100 text-rose-800", icon: <CalendarOff className="h-3.5 w-3.5" /> });
        break;
      case "half-day":
        badges.push({ label: "Half Day", color: "bg-orange-100 text-orange-800", icon: <Clock className="h-3.5 w-3.5" /> });
        break;
      case "late":
      case "late-and-overtime":
        badges.push({ label: "Present (Late)", color: "bg-amber-100 text-amber-800", icon: <AlertTriangle className="h-3.5 w-3.5" /> });
        break;
      case "sunday-worked":
        badges.push({ label: "Sunday Worked", color: "bg-purple-100 text-purple-800", icon: <Sun className="h-3.5 w-3.5" /> });
        break;
      case "sunday-off":
        badges.push({ label: "Sunday Off", color: "bg-slate-100 text-slate-600", icon: <Sun className="h-3.5 w-3.5" /> });
        break;
      case "holiday":
        break; // already added above
      case "holiday-worked":
        badges.push({ label: "Worked on Holiday", color: "bg-fuchsia-100 text-fuchsia-800", icon: <PartyPopper className="h-3.5 w-3.5" /> });
        break;
    }

    if (isLate) {
      badges.push({ label: `Late by ${lateMinutes} min`, color: "bg-amber-100 text-amber-800", icon: <AlertTriangle className="h-3.5 w-3.5" /> });
    }
    if (isEarlyLeave) {
      badges.push({ label: `Left early by ${earlyLeaveMinutes} min`, color: "bg-teal-100 text-teal-800", icon: <LogOut className="h-3.5 w-3.5" /> });
    }
    if (isOvertime) {
      badges.push({ label: `Overtime ${formatMinutes(overtimeMinutes)}`, color: "bg-blue-100 text-blue-800", icon: <Timer className="h-3.5 w-3.5" /> });
    }

    return badges;
  };

  const badges = getStatusBadge();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{dateDisplay}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((badge, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${badge.color}`}
                >
                  {badge.icon}
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {rec ? (
            <>
              {/* Time Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <LogIn className="h-4 w-4 text-green-500" />
                    <span>In Time</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatTime(rec.in_time)}
                  </p>
                  <p className="text-xs text-slate-400">Expected: {formatTime(effectiveInTime)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <LogOut className="h-4 w-4 text-red-500" />
                    <span>Out Time</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatTime(rec.out_time)}
                  </p>
                  <p className="text-xs text-slate-400">Expected: {formatTime(effectiveOutTime)}</p>
                </div>
              </div>

              {/* Work Details */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs font-medium text-slate-500">Duration</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {formatDuration(rec.duration)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs font-medium text-slate-500">Late By</p>
                  <p className={`mt-1 text-sm font-bold ${isLate ? "text-amber-600" : "text-slate-900"}`}>
                    {rec.late_by && rec.late_by > 0 ? `${rec.late_by} min` : "-"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs font-medium text-slate-500">Early By</p>
                  <p className={`mt-1 text-sm font-bold ${isEarlyLeave ? "text-teal-600" : "text-slate-900"}`}>
                    {isEarlyLeave ? `${earlyLeaveMinutes} min` : "-"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs font-medium text-slate-500">Overtime</p>
                  <p className={`mt-1 text-sm font-bold ${isOvertime ? "text-blue-600" : "text-slate-900"}`}>
                    {rec.overtime && rec.overtime > 0 ? formatMinutes(rec.overtime) : "-"}
                  </p>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-slate-500">Status</span>
                  <span className="font-medium text-slate-900">{rec.status ?? "-"}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-slate-500">Status Code</span>
                  <span className="font-medium text-slate-900">{rec.status_code ?? "-"}</span>
                </div>
                {rec.work_mode && (
                  <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">Work Mode</span>
                    <span className="font-medium text-slate-900">{rec.work_mode}</span>
                  </div>
                )}
                {rec.punch_records && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">Punch Records</span>
                    <p className="mt-1 font-mono text-xs text-slate-700 break-all">
                      {rec.punch_records}
                    </p>
                  </div>
                )}
                {rec.leave_type && (
                  <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">Leave Type</span>
                    <span className="font-medium text-slate-900">{rec.leave_type}</span>
                  </div>
                )}
                {(rec.missed_in_punch || rec.missed_out_punch) && (
                  <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      {rec.missed_in_punch && <p>Missed in-punch</p>}
                      {rec.missed_out_punch && <p>Missed out-punch</p>}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              {holiday ? (
                <div>
                  <PartyPopper className="mx-auto h-10 w-10 text-pink-400" />
                  <p className="mt-3 text-lg font-semibold text-slate-900">{holiday.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {holiday.type === "public" ? "Public Holiday" : holiday.type === "optional" ? "Optional Holiday" : "Restricted Holiday"}
                  </p>
                </div>
              ) : status === "absent" || status === "leave" ? (
                <div>
                  <CalendarOff className="mx-auto h-10 w-10 text-rose-400" />
                  <p className="mt-3 text-lg font-semibold text-slate-900">Leave</p>
                  <p className="mt-1 text-sm text-slate-500">No attendance record for this day</p>
                </div>
              ) : status === "sunday-off" ? (
                <div>
                  <Sun className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-3 text-lg font-semibold text-slate-900">Sunday Off</p>
                  <p className="mt-1 text-sm text-slate-500">Weekly off day</p>
                </div>
              ) : (
                <div>
                  <Clock className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">No data available for this day</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
