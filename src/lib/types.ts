export interface Department {
  department_id: number;
  dept_name: string;
  staff_count: number;
}

export interface Employee {
  employee_id: number;
  employee_name: string;
  employee_code: string;
  emp_id: string | null;
  department_id: number;
  designation: string;
  status: string;
  synced_at: string | null;
  in_time: string | null;
  out_time: string | null;
  department?: Department | null;
}

export interface AttendanceRecord {
  id: number;
  attendance_log_id: number | null;
  attendance_date: string;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  in_time: string | null;
  out_time: string | null;
  duration: number | null;
  late_by: number | null;
  early_by: number | null;
  is_on_leave: boolean;
  leave_type: string | null;
  status: string | null;
  status_code: string | null;
  overtime: number | null;
  shift_id: number | null;
  present: number | null;
  absent: number | null;
  punch_records: string | null;
  missed_in_punch: boolean | null;
  missed_out_punch: boolean | null;
  source_db: string | null;
  polled_at: string | null;
  work_mode: string | null;
}

export interface EditLog {
  id: number;
  edited_by: string;
  editor_email: string;
  table_name: string;
  record_id: string;
  old_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  action: string;
  created_at: string;
}

export interface EmployeeMetrics {
  totalP: number;            // SUM(present): payroll present-equivalent (P=1, half-day=0.5)
  totalWorkingDays: number;  // days physically came to work (each a whole day)
  totalSundaysWorked: number;
  totalLeaves: number;
  earlyLeaveDays: number;    // HD/E count
  hdLateDays: number;        // HD/L count
  halfDayNormal: number;     // normal half-days (½P / HD)
  missedPunchDays: number;   // MP count
  overtimeMinutes: number;
  overtimeFormatted: string;
}

export interface MonthlyAttendanceSummary {
  employee: Employee;
  metrics: EmployeeMetrics;
  records: AttendanceRecord[];
}

export interface Holiday {
  id: number;
  holiday_date: string;
  name: string;
  type: 'public' | 'optional' | 'restricted';
  created_by: string | null;
  created_at: string;
}

export type DayStatus =
  | 'present'
  | 'absent'
  | 'leave'
  | 'half-day'
  | 'half-day-late'
  | 'half-day-early'
  | 'late'
  | 'late-and-overtime'
  | 'overtime'
  | 'missed-punch'
  | 'holiday'
  | 'holiday-worked'
  | 'weekend'
  | 'future'
  | 'no-record';

export interface DayInfo {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Sun
  status: DayStatus;
  record: AttendanceRecord | null;
  holiday: Holiday | null;
  isLate: boolean;
  isOvertime: boolean;
  isEarlyLeave: boolean;
  isHalfDay: boolean;
  isSunday: boolean;
}

export interface DepartmentSummary {
  department: Department;
  employees: MonthlyAttendanceSummary[];
  totalPresent: number;
  totalLeaves: number;
  averageLateDays: number;
}
