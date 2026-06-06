import { clsx, type ClassValue } from "clsx";
import type { EmployeeMetrics } from "./types";

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
 * A row from the `employee_monthly_metrics` DB view. All attendance maths is
 * done in the backend (see the view definition) — the frontend only displays.
 */
export interface MonthlyMetricsRow {
  employee_id: number;
  year: number;
  month: number;
  total_p: number;          // SUM(present): payroll present-equivalent (P=1, half-day=0.5)
  days_present: number;     // days physically came to work (each a whole day)
  sundays_worked: number;   // Sundays with overtime
  sundays_absent: number;   // Sundays not worked (present=0) — Store "days off" component
  early_left: number;       // HD/E count (deprecated — HD/E removed; always 0)
  hd_late: number;          // HD/L count
  half_day_normal: number;  // normal half-days (½P / HD)
  missed_punch: number;          // MP count (display only)
  missed_punch_weekday: number;  // MP on weekdays only — used in Adj Leave to avoid
                                 // double-counting a Sunday MP already in Days Off
  days_leave: number;            // full-day leaves + absences (excl. Sundays & holidays)
  lot_minutes: number;      // loss of time: Σ early_by on Present days
  overtime_minutes: number; // SUM(overtime) excluding leave days
  first_record_day: number; // earliest day-of-month with a record (1 = established; >1 = joined mid-month)
}

/**
 * Maps a backend metrics row into the display shape. No calculation here —
 * just shaping and formatting the values the DB view already computed.
 */
export function metricsFromRow(row?: MonthlyMetricsRow | null): EmployeeMetrics {
  const ot = row?.overtime_minutes ?? 0;
  return {
    totalP: row?.total_p ?? 0,
    totalWorkingDays: row?.days_present ?? 0,
    totalSundaysWorked: row?.sundays_worked ?? 0,
    sundaysAbsent: row?.sundays_absent ?? 0,
    totalLeaves: row?.days_leave ?? 0,
    earlyLeaveDays: row?.early_left ?? 0,
    hdLateDays: row?.hd_late ?? 0,
    halfDayNormal: row?.half_day_normal ?? 0,
    missedPunchDays: row?.missed_punch ?? 0,
    missedPunchWeekdays: row?.missed_punch_weekday ?? 0,
    lotMinutes: row?.lot_minutes ?? 0,
    firstRecordDay: row?.first_record_day ?? 1,
    overtimeMinutes: ot,
    overtimeFormatted: formatMinutes(ot),
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
