"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AttendanceRecord, Holiday, DayInfo, DayStatus } from "@/lib/types";
import DayDetailModal from "./DayDetailModal";

interface AttendanceCalendarProps {
  attendanceRecords: AttendanceRecord[];
  holidays: Holiday[];
  year: number;
  month: number; // 1-12
  employeeInTime: string; // e.g. "09:00:00"
  employeeOutTime: string; // e.g. "18:00:00"
  employeeName?: string;
  departmentName?: string;
  onMonthChange?: (year: number, month: number) => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseTimeStr(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(":");
  return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
}

function extractTimeFromTimestamp(timestamp: string): { hours: number; minutes: number } {
  const timePart = timestamp.split(/[T ]/)[1];
  if (!timePart) return { hours: 0, minutes: 0 };
  const parts = timePart.split(":");
  return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
}

function minutesDiff(
  a: { hours: number; minutes: number },
  b: { hours: number; minutes: number }
): number {
  return a.hours * 60 + a.minutes - (b.hours * 60 + b.minutes);
}

export default function AttendanceCalendar({
  attendanceRecords,
  holidays,
  year,
  month,
  employeeInTime,
  employeeOutTime,
  employeeName,
  departmentName,
  onMonthChange,
}: AttendanceCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<DayInfo | null>(null);

  const expectedIn = parseTimeStr(employeeInTime);
  const expectedOut = parseTimeStr(employeeOutTime);

  // Store department has different Sunday timings: 11:00 - 18:00
  const isStoreDept = departmentName?.toLowerCase() === "store";
  const sundayExpectedIn = isStoreDept ? parseTimeStr("11:00:00") : expectedIn;
  const sundayExpectedOut = isStoreDept ? parseTimeStr("18:00:00") : expectedOut;

  // Build lookup maps
  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const rec of attendanceRecords) {
      if (rec.attendance_date) {
        map.set(rec.attendance_date, rec);
      }
    }
    return map;
  }, [attendanceRecords]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays) {
      map.set(h.holiday_date, h);
    }
    return map;
  }, [holidays]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  // Build day info for each day of the month
  const dayInfos: (DayInfo | null)[] = useMemo(() => {
    const days: (DayInfo | null)[] = [];

    // Padding for first week
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayOfWeek = dateObj.getDay();
      const isSunday = dayOfWeek === 0;
      const isFuture = dateStr > todayStr;

      const rec = recordMap.get(dateStr) ?? null;
      const holiday = holidayMap.get(dateStr) ?? null;

      let isLate = false;
      let isOvertime = false;
      let isEarlyLeave = false;
      let isHalfDay = false;
      const isPresent = rec ? (rec.present ?? 0) > 0 && !rec.is_on_leave : false;
      const isOnLeave = rec?.is_on_leave === true;

      // Check half-day: present is 0.5 or duration < 4 hours (240 min)
      if (rec && isPresent) {
        if (rec.present === 0.5 || (rec.duration !== null && rec.duration > 0 && rec.duration < 240)) {
          isHalfDay = true;
        }
      }

      // Use Sunday times for Store department on Sundays
      const effectiveExpectedIn = isSunday ? sundayExpectedIn : expectedIn;
      const effectiveExpectedOut = isSunday ? sundayExpectedOut : expectedOut;

      // Check late (half-day leave should not count as late)
      if (isPresent && !isHalfDay && rec?.in_time) {
        const actualIn = extractTimeFromTimestamp(rec.in_time);
        if (minutesDiff(actualIn, effectiveExpectedIn) > 10) {
          isLate = true;
        }
      }

      // Check overtime and early leave
      if (isPresent && !isHalfDay && rec?.out_time) {
        const actualOut = extractTimeFromTimestamp(rec.out_time);
        const outDiff = minutesDiff(actualOut, effectiveExpectedOut);
        if (outDiff > 30) {
          isOvertime = true;
        }
        if (outDiff < -10) {
          isEarlyLeave = true;
        }
      }

      // Determine status
      let status: DayStatus;
      if (isFuture) {
        status = holiday ? "holiday" : "future";
      } else if (holiday && !isPresent && !isOnLeave) {
        status = "holiday";
      } else if (holiday && isPresent) {
        status = "holiday-worked";
      } else if (isSunday && isPresent) {
        status = "sunday-worked";
      } else if (isSunday && !isPresent) {
        status = "sunday-off";
      } else if (isOnLeave) {
        status = "leave";
      } else if (isHalfDay) {
        status = "half-day";
      } else if (isLate && isOvertime) {
        status = "late-and-overtime";
      } else if (isLate) {
        status = "late";
      } else if (isOvertime) {
        status = "overtime";
      } else if (isPresent) {
        status = "present";
      } else if (!rec && !isFuture) {
        status = "leave";
      } else {
        status = "no-record";
      }

      days.push({
        date: dateObj,
        dateStr,
        dayOfWeek,
        status,
        record: rec,
        holiday,
        isLate,
        isOvertime,
        isEarlyLeave,
        isHalfDay,
        isSunday,
      });
    }

    return days;
  }, [year, month, daysInMonth, firstDayOfWeek, recordMap, holidayMap, expectedIn, expectedOut, sundayExpectedIn, sundayExpectedOut, todayStr]);

  // Pad last week
  const totalCells = dayInfos.length;
  const remainder = totalCells % 7;
  const paddedDays = remainder === 0 ? dayInfos : [...dayInfos, ...Array(7 - remainder).fill(null)];

  const getStatusStyle = (status: DayStatus): string => {
    switch (status) {
      case "present":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200";
      case "absent":
        return "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200";
      case "leave":
        return "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200";
      case "half-day":
        return "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200";
      case "late":
        return "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200";
      case "late-and-overtime":
        return "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200";
      case "overtime":
        return "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200";
      case "sunday-worked":
        return "bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200";
      case "sunday-off":
        return "bg-slate-100 text-slate-500 border-slate-200";
      case "holiday":
        return "bg-pink-100 text-pink-800 border-pink-300 hover:bg-pink-200";
      case "holiday-worked":
        return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300 hover:bg-fuchsia-200";
      case "future":
        return "bg-slate-50 text-slate-300 border-slate-100";
      case "no-record":
        return "bg-slate-50 text-slate-400 border-slate-100";
      default:
        return "bg-slate-50 text-slate-400 border-slate-100";
    }
  };

  const getStatusLabel = (info: DayInfo): string => {
    switch (info.status) {
      case "present": return "P";
      case "absent": return "L";
      case "leave": return "L";
      case "half-day": return "HD";
      case "late": return "Late";
      case "late-and-overtime": return "L+OT";
      case "overtime": return "OT";
      case "sunday-worked": return "SW";
      case "sunday-off": return "SO";
      case "holiday": return "H";
      case "holiday-worked": return "HW";
      case "future": return "";
      case "no-record": return "-";
      default: return "";
    }
  };

  const getStatusEmoji = (info: DayInfo): string => {
    switch (info.status) {
      case "present": return "";
      case "absent": return "";
      case "leave": return "";
      case "half-day": return "";
      case "late": return "";
      case "late-and-overtime": return "";
      case "overtime": return "";
      case "sunday-worked": return "";
      case "sunday-off": return "";
      case "holiday": return "";
      case "holiday-worked": return "";
      default: return "";
    }
  };

  const handlePrev = () => {
    if (!onMonthChange) return;
    if (month === 1) onMonthChange(year - 1, 12);
    else onMonthChange(year, month - 1);
  };

  const handleNext = () => {
    if (!onMonthChange) return;
    if (month === 12) onMonthChange(year + 1, 1);
    else onMonthChange(year, month + 1);
  };

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

  // Count stats
  const stats = useMemo(() => {
    const validDays = dayInfos.filter((d): d is DayInfo => d !== null && d.status !== "future");
    return {
      present: validDays.filter((d) => ["present", "overtime", "late-and-overtime"].includes(d.status)).length,
      late: validDays.filter((d) => d.isLate).length,
      leave: validDays.filter((d) => d.status === "leave" || d.status === "absent").length,
      halfDay: validDays.filter((d) => d.status === "half-day").length,
      overtime: validDays.filter((d) => d.isOvertime).length,
      earlyLeave: validDays.filter((d) => d.isEarlyLeave).length,
      sundayWorked: validDays.filter((d) => d.status === "sunday-worked").length,
      holidays: validDays.filter((d) => ["holiday", "holiday-worked"].includes(d.status)).length,
    };
  }, [dayInfos]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <button
          onClick={handlePrev}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-900">
            {monthName} {year}
          </h3>
          {employeeName && (
            <p className="text-sm text-slate-500">{employeeName}</p>
          )}
        </div>
        <button
          onClick={handleNext}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Quick Stats Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-3 text-xs">
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
          {stats.present} Present
        </span>
        <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700">
          {stats.leave} Leave
        </span>
        <span className="rounded-full bg-orange-100 px-2.5 py-1 font-medium text-orange-700">
          {stats.halfDay} Half-Day
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
          {stats.late} Late
        </span>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-700">
          {stats.overtime} OT
        </span>
        <span className="rounded-full bg-teal-100 px-2.5 py-1 font-medium text-teal-700">
          {stats.earlyLeave} Early Left
        </span>
        <span className="rounded-full bg-purple-100 px-2.5 py-1 font-medium text-purple-700">
          {stats.sundayWorked} Sun Worked
        </span>
        <span className="rounded-full bg-pink-100 px-2.5 py-1 font-medium text-pink-700">
          {stats.holidays} Holidays
        </span>
      </div>

      {/* Calendar Grid */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-7 gap-1.5">
          {/* Day headers */}
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className={`py-2 text-center text-xs font-bold uppercase tracking-wider ${
                day === "Sun" ? "text-red-500" : "text-slate-500"
              }`}
            >
              {day}
            </div>
          ))}

          {/* Day cells */}
          {paddedDays.map((info, idx) => {
            if (!info) {
              return <div key={`pad-${idx}`} className="aspect-square" />;
            }

            const style = getStatusStyle(info.status);
            const label = getStatusLabel(info);
            const isToday = info.dateStr === todayStr;
            const isClickable = info.status !== "future";

            return (
              <button
                key={info.dateStr}
                onClick={() => isClickable && setSelectedDay(info)}
                disabled={!isClickable}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-medium transition-all ${style} ${
                  isToday ? "ring-2 ring-indigo-500 ring-offset-1" : ""
                } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
              >
                {/* Day number */}
                <span className={`text-[10px] leading-none ${isToday ? "font-black" : "opacity-70"}`}>
                  {info.date.getDate()}
                </span>

                {/* Status label */}
                {label && (
                  <span className="mt-0.5 text-[11px] font-bold leading-none">
                    {label}
                  </span>
                )}

                {/* Holiday name indicator */}
                {info.holiday && (
                  <span className="absolute bottom-0.5 left-0.5 right-0.5 truncate text-center text-[7px] font-medium leading-none opacity-70">
                    {info.holiday.name}
                  </span>
                )}

                {/* Multi-indicator badges */}
                <div className="absolute -top-0.5 -right-0.5 flex gap-0.5">
                  {info.isOvertime && info.status !== "overtime" && info.status !== "late-and-overtime" && (
                    <span className="rounded bg-blue-500 px-0.5 text-[7px] font-bold text-white">OT</span>
                  )}
                  {info.isEarlyLeave && (
                    <span className="rounded bg-teal-500 px-0.5 text-[7px] font-bold text-white">EL</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 px-6 py-4">
        {[
          { color: "bg-emerald-200", label: "Present" },
          { color: "bg-rose-200", label: "Leave" },
          { color: "bg-orange-200", label: "Half-Day" },
          { color: "bg-amber-200", label: "Late" },
          { color: "bg-blue-200", label: "Overtime" },
          { color: "bg-teal-200", label: "Early Left" },
          { color: "bg-purple-200", label: "Sunday Worked" },
          { color: "bg-pink-200", label: "Holiday" },
          { color: "bg-fuchsia-200", label: "Holiday Worked" },
          { color: "bg-slate-200", label: "Sunday Off / No Record" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded ${item.color}`} />
            <span className="text-[11px] text-slate-600">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <DayDetailModal
          dayInfo={selectedDay}
          employeeInTime={employeeInTime}
          employeeOutTime={employeeOutTime}
          departmentName={departmentName}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
