import { clsx, type ClassValue } from "clsx";
import type { AttendanceRecord, Employee, EmployeeMetrics, Holiday } from "./types";

/**
 * Converts total minutes into HH:MM format.
 */
export function formatMinutes(minutes: number): string {
  const hrs = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Extracts hours and minutes directly from a timestamp or time string
 * WITHOUT any timezone conversion. The DB stores local times as +00,
 * so we parse the time portion from the raw string.
 */
function extractHoursMinutes(timeStr: string): { hours: number; minutes: number } | null {
  // Full timestamp like "2026-02-01 10:57:44+00" or "2026-02-01T10:57:44+00:00"
  if (timeStr.includes("-") && timeStr.length > 10) {
    // Extract the time part after the date (after space or T)
    const timePart = timeStr.split(/[T ]/)[1];
    if (!timePart) return null;
    const parts = timePart.split(":");
    return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
  }
  // Plain time string like "09:00:00" or "09:00"
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return { hours, minutes };
}

/**
 * Format a time string (HH:MM:SS or HH:MM) or timestamp into HH:MM AM/PM display.
 * Does NOT apply timezone conversion — times are treated as-is from the DB.
 */
export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "-";

  const parsed = extractHoursMinutes(timeStr);
  if (!parsed) return timeStr;

  const { hours, minutes } = parsed;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

/**
 * Format a date string (YYYY-MM-DD) into a readable format.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format duration in minutes to a readable string like "7h 03m".
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "-";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${String(mins).padStart(2, "0")}m`;
}

/**
 * Extracts the time portion (HH:MM) from a timestamp or time string
 * and returns it as total minutes since midnight.
 * Does NOT apply timezone conversion — parses time directly from string.
 */
export function timeToMinutes(timeStr: string): number {
  const parsed = extractHoursMinutes(timeStr);
  if (!parsed) return 0;
  return parsed.hours * 60 + parsed.minutes;
}



/**
 * Calculates total overtime in minutes from DB-computed overtime field.
 */
export function calculateOvertime(
  _employeeOutTime: string,
  attendanceRecords: AttendanceRecord[],
  _departmentName?: string
): number {
  return attendanceRecords.reduce((sum, r) => sum + (r.overtime ?? 0), 0);
}

/**
 * Counts the number of days an employee left early.
 * Uses DB-computed early_by (no grace period).
 */
export function calculateEarlyLeaveDays(
  _employeeOutTime: string,
  attendanceRecords: AttendanceRecord[],
  _departmentName?: string
): number {
  return attendanceRecords.filter(
    (r) => !r.is_on_leave && r.early_by != null && r.early_by > 0
  ).length;
}

/**
 * Calculates all employee metrics for a given month.
 */
export function calculateEmployeeMetrics(
  employee: Employee,
  attendanceRecords: AttendanceRecord[],
  year: number,
  month: number,
  departmentName?: string,
  holidays?: Holiday[]
): EmployeeMetrics {
  // Filter records for the given month
  const monthRecords = attendanceRecords.filter((r) => {
    const d = new Date(r.attendance_date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  // Total working days (records where employee was present)
  const totalWorkingDays = monthRecords.filter(
    (r) => r.present !== null && r.present > 0
  ).length;

  // Sundays worked
  const totalSundaysWorked = monthRecords.filter((r) => {
    const d = new Date(r.attendance_date + "T00:00:00");
    return d.getDay() === 0 && r.present !== null && r.present > 0;
  }).length;

  // Total leaves: count all non-present weekdays (Mon-Sat) that are not holidays or future
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const holidayDates = new Set((holidays ?? []).map((h) => h.holiday_date));
  const presentDates = new Set(
    monthRecords
      .filter((r) => r.present !== null && r.present > 0)
      .map((r) => r.attendance_date)
  );
  const explicitLeaveDates = new Set(
    monthRecords
      .filter((r) => r.is_on_leave === true)
      .map((r) => r.attendance_date)
  );
  const daysInMonth = new Date(year, month, 0).getDate();
  let totalLeaves = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dateStr > todayStr) continue; // skip future dates
    if (dateObj.getDay() === 0) continue; // skip Sundays
    if (holidayDates.has(dateStr)) continue; // skip holidays
    if (!presentDates.has(dateStr) || explicitLeaveDates.has(dateStr)) {
      totalLeaves++;
    }
  }

  const presentRecords = monthRecords.filter(
    (r) => r.in_time && !r.is_on_leave
  );

  // Early leave days
  const earlyLeaveDays = employee.out_time
    ? calculateEarlyLeaveDays(employee.out_time, presentRecords, departmentName)
    : 0;

  // Overtime
  const overtimeMinutes = employee.out_time
    ? calculateOvertime(employee.out_time, presentRecords, departmentName)
    : 0;

  const overtimeFormatted = formatMinutes(overtimeMinutes);

  return {
    totalWorkingDays,
    totalSundaysWorked,
    totalLeaves,
    earlyLeaveDays,
    overtimeMinutes,
    overtimeFormatted,
  };
}

/**
 * Returns an array of all dates in a given month.
 */
export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month - 1, d));
  }
  return days;
}

/**
 * Utility for merging Tailwind CSS class names.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Sanitizes a single CSV cell value to prevent CSV/formula injection.
 *
 * Spreadsheet applications (Excel, Google Sheets) treat cells beginning with
 * =, +, -, @, TAB, or CR as formulas. Prefixing with a single quote tells
 * the app to treat the value as plain text and is stripped from display.
 */
function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Exports an array of objects as a CSV file download.
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map((h) => `"${sanitizeCsvCell(h)}"`).join(","));

  // Data rows
  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h];
      const sanitized = sanitizeCsvCell(String(val ?? ""));
      const escaped = sanitized.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
