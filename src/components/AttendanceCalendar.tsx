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
  employeeInTime: string;
  employeeOutTime: string;
  employeeName?: string;
  departmentName?: string;
  onMonthChange?: (year: number, month: number) => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Returns { num, unit } for the clock-style badge, or null if no value. */
function formatClockBadge(minutes: number | null | undefined): { num: string; unit: string } | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return { num: String(minutes), unit: "min" };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { num: `${h}:${String(m).padStart(2, "0")}`, unit: "h : m" };
}

/** Horizontal split style for half-day cells. */
function getGradientStyle(info: DayInfo): React.CSSProperties {
  // HD/L: amber top (missed morning) / green bottom (worked afternoon)
  if (info.status === "half-day-late")  return { background: "linear-gradient(to bottom, #fde68a 50%, #bbf7d0 50%)" };
  // HD/E: green top (worked morning) / amber bottom (missed afternoon)
  if (info.status === "half-day-early") return { background: "linear-gradient(to bottom, #bbf7d0 50%, #fde68a 50%)" };
  if (info.status === "half-day") {
    const raw = info.record?.in_time ?? "";
    const timeStr = raw.includes("T") ? raw.split("T")[1] : raw;
    const h = parseInt(timeStr?.split(":")[0] ?? "0", 10);
    // in_time before 1pm → worked first half → green top / grey bottom
    // in_time at/after 1pm or no in_time → worked second half → grey top / green bottom
    return !timeStr || h >= 13
      ? { background: "linear-gradient(to bottom, #f8fafc 50%, #bbf7d0 50%)" }
      : { background: "linear-gradient(to bottom, #bbf7d0 50%, #f8fafc 50%)" };
  }
  return {};
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

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const rec of attendanceRecords) {
      if (rec.attendance_date) map.set(rec.attendance_date, rec);
    }
    return map;
  }, [attendanceRecords]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays) map.set(h.holiday_date, h);
    return map;
  }, [holidays]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const dayInfos: (DayInfo | null)[] = useMemo(() => {
    const days: (DayInfo | null)[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayOfWeek = dateObj.getDay();
      const isSunday = dayOfWeek === 0;
      const isFuture = dateStr > todayStr;

      const rec = recordMap.get(dateStr) ?? null;
      const holiday = holidayMap.get(dateStr) ?? null;

      const isPresent = rec ? (rec.present ?? 0) > 0 && !rec.is_on_leave : false;
      const isOnLeave = rec?.is_on_leave === true;

      // Half-day purely from DB status_code (includes biometric ½P variants)
      const statusCode = rec?.status_code?.trim() ?? "";
      const isHalfDay  = ["HD", "HD/L", "HD/E", "½P"].includes(statusCode);

      // WOP = "Weekly Off Present": came in on an off day; whole shift is OT.
      const isWop = statusCode === "WOP";

      // MP = "Missed Punch": only one swipe recorded — incomplete day.
      const isMissedPunch = statusCode === "MP";

      // Only flag late/OT/early on full days
      const isLate       = isPresent && !isHalfDay && (rec?.late_by ?? 0) > 0;
      const isOvertime   = !isHalfDay && (rec?.overtime ?? 0) > 0 && (isPresent || isWop);
      const isEarlyLeave = isPresent && !isHalfDay && (rec?.early_by ?? 0) > 0;

      let status: DayStatus;
      if (isFuture) {
        status = holiday ? "holiday" : "future";
      } else if (holiday && !isPresent && !isOnLeave) {
        status = "holiday";
      } else if (holiday && isPresent) {
        status = "holiday-worked";
      } else if (isOnLeave) {
        status = "leave";
      } else if (isMissedPunch) {
        status = "missed-punch";
      } else if (isHalfDay) {
        if (statusCode === "HD/L")                    status = "half-day-late";
        else if (statusCode === "HD/E")               status = "half-day-early";
        else                                          status = "half-day";
      } else if (isLate && isOvertime) {
        status = "overtime";
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

      days.push({ date: dateObj, dateStr, dayOfWeek, status, record: rec, holiday, isLate, isOvertime, isEarlyLeave, isHalfDay, isSunday });
    }

    return days;
  }, [year, month, daysInMonth, firstDayOfWeek, recordMap, holidayMap, todayStr]);

  const paddedDays = (() => {
    const remainder = dayInfos.length % 7;
    return remainder === 0 ? dayInfos : [...dayInfos, ...Array(7 - remainder).fill(null)];
  })();

  const getStatusStyle = (status: DayStatus): string => {
    switch (status) {
      case "present":           return "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200";
      case "absent":
      case "leave":             return "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200";
      case "half-day":
      case "half-day-late":
      case "half-day-early":    return "border-emerald-300 text-emerald-800 hover:brightness-95";
      case "late":
      case "late-and-overtime": return "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200";
      case "overtime":          return "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200";
      case "missed-punch":      return "bg-slate-700 text-white border-slate-800 hover:bg-slate-600";
      case "holiday":           return "bg-pink-100 text-pink-800 border-pink-300 hover:bg-pink-200";
      case "holiday-worked":    return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300 hover:bg-fuchsia-200";
      case "future":            return "bg-slate-50 text-slate-300 border-slate-100";
      default:                  return "bg-slate-50 text-slate-400 border-slate-100";
    }
  };

  const getStatusLabel = (info: DayInfo): string => {
    switch (info.status) {
      case "present":           return "P";
      case "absent":
      case "leave":             return "L";
      case "half-day":          return "HD";
      case "half-day-late":     return "HD/L";
      case "half-day-early":    return "HD/E";
      case "late":              return "Late";
      case "late-and-overtime": return "L+OT";
      case "overtime":          return "OT";
      case "missed-punch":      return "MP";
      case "holiday":           return "H";
      case "holiday-worked":    return "HW";
      case "future":            return "";
      case "no-record":         return "-";
      default:                  return "";
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

  const stats = useMemo(() => {
    const validDays = dayInfos.filter((d): d is DayInfo => d !== null && d.status !== "future");
    return {
      present:      validDays.filter((d) => ["present", "overtime", "late-and-overtime"].includes(d.status)).length,
      late:         validDays.filter((d) => d.isLate).length,
      leave:        validDays.filter((d) => d.status === "leave" || d.status === "absent").length,
      halfDay:      validDays.filter((d) => ["half-day", "half-day-late", "half-day-early"].includes(d.status)).length,
      overtime:     validDays.filter((d) => d.isOvertime).length,
      earlyLeave:   validDays.filter((d) => d.isEarlyLeave).length,
      missedPunch:  validDays.filter((d) => d.status === "missed-punch").length,
      holidays:     validDays.filter((d) => ["holiday", "holiday-worked"].includes(d.status)).length,
    };
  }, [dayInfos]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <button onClick={handlePrev} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-900">{monthName} {year}</h3>
          {employeeName && <p className="text-sm text-slate-500">{employeeName}</p>}
        </div>
        <button onClick={handleNext} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Quick Stats Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-3 text-xs">
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">{stats.present} Present</span>
        <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700">{stats.leave} Leave</span>
        <span className="rounded-full bg-orange-100 px-2.5 py-1 font-medium text-orange-700">{stats.halfDay} Half-Day</span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">{stats.late} Late</span>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-700">{stats.overtime} OT</span>
        <span className="rounded-full bg-teal-100 px-2.5 py-1 font-medium text-teal-700">{stats.earlyLeave} Early Left</span>
        <span className="rounded-full bg-slate-700 px-2.5 py-1 font-medium text-white">{stats.missedPunch} Missed Punch</span>
        <span className="rounded-full bg-pink-100 px-2.5 py-1 font-medium text-pink-700">{stats.holidays} Holidays</span>
      </div>

      {/* Calendar Grid */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className={`py-2 text-center text-xs font-bold uppercase tracking-wider ${day === "Sun" ? "text-red-500" : "text-slate-500"}`}>
              {day}
            </div>
          ))}

          {paddedDays.map((info, idx) => {
            if (!info) return <div key={`pad-${idx}`} className="aspect-square" />;

            const styleClass = getStatusStyle(info.status);
            const gradientStyle = getGradientStyle(info);
            const label = getStatusLabel(info);
            const isToday = info.dateStr === todayStr;
            const isClickable = info.status !== "future";

            // Clock badge: HD/L shows late_by, HD/E shows early_by, OT shows overtime
            const badge =
              info.status === "half-day-late"  ? formatClockBadge(info.record?.late_by) :
              info.status === "half-day-early" ? formatClockBadge(info.record?.early_by) :
              info.status === "overtime"       ? formatClockBadge(info.record?.overtime) :
              null;

            return (
              <button
                key={info.dateStr}
                onClick={() => isClickable && setSelectedDay(info)}
                disabled={!isClickable}
                style={gradientStyle}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-medium transition-all ${styleClass} ${
                  isToday ? "ring-2 ring-indigo-500 ring-offset-1" : ""
                } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className={`text-[10px] leading-none ${isToday ? "font-black" : "opacity-70"}`}>
                  {info.date.getDate()}
                </span>

                {label && (
                  <span className="mt-0.5 text-[11px] font-bold leading-none">
                    {label}
                  </span>
                )}

                {/* Clock badge for HD/L, HD/E, OT */}
                {badge && (
                  <div className="absolute bottom-1 z-10 flex flex-col items-center rounded-md bg-black/10 px-1.5 py-0.5 leading-tight">
                    <span className="text-[10px] font-black leading-none">{badge.num}</span>
                    <span className="text-[6px] font-semibold uppercase leading-none opacity-70">{badge.unit}</span>
                  </div>
                )}

                {info.record?.shift_id && !info.holiday && (
                  <span className="absolute bottom-0.5 left-0.5 text-[7px] font-bold leading-none opacity-50">
                    S{info.record.shift_id}
                  </span>
                )}

                {info.holiday && (
                  <span className="absolute bottom-0.5 left-0.5 right-0.5 truncate text-center text-[7px] font-medium leading-none opacity-70">
                    {info.holiday.name}
                  </span>
                )}

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
          { style: { background: "linear-gradient(to bottom, #bbf7d0 50%, #f8fafc 50%)" }, label: "HD (1st half)" },
          { style: { background: "linear-gradient(to bottom, #f8fafc 50%, #bbf7d0 50%)" }, label: "HD (2nd half)" },
          { style: { background: "linear-gradient(to bottom, #fde68a 50%, #bbf7d0 50%)" }, label: "HD/L (came late)" },
          { style: { background: "linear-gradient(to bottom, #bbf7d0 50%, #fde68a 50%)" }, label: "HD/E (left early)" },
          { color: "bg-amber-200", label: "Late" },
          { color: "bg-blue-200", label: "Overtime" },
          { color: "bg-slate-700", label: "Missed Punch" },
          { color: "bg-teal-200", label: "Early Left" },
          { color: "bg-pink-200", label: "Holiday" },
          { color: "bg-fuchsia-200", label: "Holiday Worked" },
          { color: "bg-slate-200", label: "No Record" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-3 w-3 rounded ${"color" in item ? item.color : ""}`}
              style={"style" in item ? item.style : undefined}
            />
            <span className="text-[11px] text-slate-600">{item.label}</span>
          </div>
        ))}
      </div>

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
