/**
 * ADMS fingerprint scanner receiver — /api/iclock/cdata
 *
 * GET  — device handshake on boot; returns plain-text config options
 * POST — device pushes attendance logs (ATTLOG); we store raw punches in
 *        adms_punches then process them into the attendance table.
 *
 * The device MUST receive a plain-text "OK" response to clear its local
 * buffer. Always return OK even if downstream processing fails, as long as
 * the raw punch was saved.
 *
 * Auth: optional SN check via ADMS_DEVICE_SN env var (comma-separated list).
 *       Leave blank during initial setup to accept any device.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(): NextResponse {
  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

function error(msg = "ERROR", status = 403): NextResponse {
  return new NextResponse(msg, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Validate the device serial number if ADMS_DEVICE_SN is configured.
 * Supports a comma-separated list so multiple devices can be whitelisted.
 * Returns true (allowed) when the env var is not set — easy first-time setup.
 */
function isAllowedSN(sn: string): boolean {
  const allowed = process.env.ADMS_DEVICE_SN?.trim();
  if (!allowed) return true; // no restriction configured
  return allowed.split(",").map((s) => s.trim()).includes(sn);
}

/**
 * Convert a device-local timestamp string ("YYYY-MM-DD HH:MM:SS") to a
 * Postgres-compatible ISO timestamp string.
 * ADMS_TZ_OFFSET=+00:00 (default) stores the raw IST time as-is, matching
 * the existing MDB pipeline convention (IST times stored without UTC conversion).
 */
function deviceTimeToISO(raw: string): string | null {
  if (!raw.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) return null;
  const offset = process.env.ADMS_TZ_OFFSET?.trim() ?? "+00:00";
  try {
    return new Date(`${raw.replace(" ", "T")}${offset}`).toISOString();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Body parsing — handles both firmware formats:
//   1. Form-encoded: table=ATTLOG&Stamp=9999&data=<lines>
//   2. Raw text:     ATTLOG\n<lines>  (or just bare lines)
// ---------------------------------------------------------------------------

interface ParsedBody {
  table: string;
  lines: string[];
}

async function parseBody(request: NextRequest): Promise<ParsedBody> {
  // eSSL F22 firmware puts table type in the URL query string, not the body
  const tableFromQuery = request.nextUrl.searchParams.get("table")?.toUpperCase() ?? "";

  const ct = request.headers.get("content-type") ?? "";
  const raw = await request.text();

  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    const tableFromBody = (params.get("table") ?? "").toUpperCase();
    return {
      table: tableFromQuery || tableFromBody,
      lines: (params.get("data") ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    };
  }

  // eSSL F22: table is in query string, body contains raw data lines
  if (tableFromQuery) {
    return {
      table: tableFromQuery,
      lines: raw.split("\n").map((l) => l.trim()).filter(Boolean),
    };
  }

  // Raw text — first line may be the table type header
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { table: "", lines: [] };

  if (lines[0].toUpperCase().startsWith("ATTLOG")) {
    return { table: "ATTLOG", lines: lines.slice(1) };
  }

  return { table: "ATTLOG", lines };
}

// ---------------------------------------------------------------------------
// Punch row type
// ---------------------------------------------------------------------------

interface PunchRow {
  device_sn: string;
  user_id: number;
  punch_time: string; // ISO UTC
  status: number;
  verify: number;
  work_code: string | null;
  raw_line: string;
}

/**
 * Parse one ATTLOG data line.
 * Format: UserID\tTimestamp\tStatus\tVerify\tWorkCode\tReserved
 */
function parseLine(line: string, deviceSN: string): PunchRow | null {
  const parts = line.split("\t");
  if (parts.length < 2) return null;

  const userId = parseInt(parts[0].trim(), 10);
  if (isNaN(userId)) return null;

  const punchTime = deviceTimeToISO(parts[1].trim());
  if (!punchTime) return null;

  return {
    device_sn: deviceSN,
    user_id: userId,
    punch_time: punchTime,
    status: parseInt(parts[2]?.trim() ?? "0", 10) || 0,
    verify: parseInt(parts[3]?.trim() ?? "1", 10) || 1,
    work_code: parts[4]?.trim() || null,
    raw_line: line,
  };
}

// ---------------------------------------------------------------------------
// Process punches → attendance
// ---------------------------------------------------------------------------

/**
 * For each unique (employee_id, date) in the incoming punches, fetch all
 * punches for that employee+date from adms_punches, compute in/out times,
 * then delete+insert in the attendance table.
 *
 * Errors here are logged but do NOT cause the route to return an error —
 * the raw punches are already saved; we never want the device to resend.
 */
async function processIntoAttendance(
  supabase: ReturnType<typeof createAdminClient>,
  punches: PunchRow[]
): Promise<void> {
  // Collect unique (user_id, date) pairs from this batch
  const keys = new Set<string>();
  for (const p of punches) {
    const date = p.punch_time.slice(0, 10); // UTC date YYYY-MM-DD
    keys.add(`${p.user_id}:${date}`);
  }

  for (const key of keys) {
    const [userIdStr, date] = key.split(":");
    const employeeId = parseInt(userIdStr, 10);

    try {
      // 1. Fetch ALL punches for this employee+date (not just this batch)
      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd   = `${date}T23:59:59.999Z`;

      const { data: dayPunches, error: fetchErr } = await supabase
        .from("adms_punches")
        .select("punch_time, status")
        .eq("user_id", employeeId)
        .gte("punch_time", dayStart)
        .lte("punch_time", dayEnd)
        .order("punch_time", { ascending: true });

      if (fetchErr) {
        console.error(`[adms] fetch punches for ${key}:`, fetchErr.message);
        continue;
      }
      if (!dayPunches || dayPunches.length === 0) continue;

      const inTime  = dayPunches[0].punch_time;
      const outTime = dayPunches.length > 1
        ? dayPunches[dayPunches.length - 1].punch_time
        : null;

      // Single punch heuristics for missed-punch flags
      const singleStatus = dayPunches.length === 1 ? dayPunches[0].status : null;
      const missedIn  = singleStatus === 1; // only saw check-out
      const missedOut = singleStatus === 0; // only saw check-in

      // Human-readable punch list: "09:02,18:45"
      const punchRecords = dayPunches
        .map((p) => p.punch_time.slice(11, 16))
        .join(",");

      // 2. Resolve employee name + code — skip if not in DB (device PIN not mapped)
      const { data: emp } = await supabase
        .from("employees")
        .select("employee_name, employee_code")
        .eq("employee_id", employeeId)
        .single();

      if (!emp) {
        console.warn(`[adms] employee_id=${employeeId} not in employees table — punch saved, attendance skipped`);
        continue;
      }

      // 3. Delete any existing ADMS-sourced row for this employee+date
      //    (leaves MDB-sourced rows untouched)
      const { error: delErr } = await supabase
        .from("attendance")
        .delete()
        .eq("employee_id", employeeId)
        .eq("attendance_date", date)
        .like("source_db", "adms:%");

      if (delErr) {
        console.error(`[adms] delete attendance for ${key}:`, delErr.message);
        continue;
      }

      // 4. Insert processed attendance row
      //    DB trigger will fill duration, late_by, early_by, overtime, shift_id
      const { error: insErr } = await supabase.from("attendance").insert({
        attendance_date:  date,
        employee_id:      employeeId,
        employee_name:    emp?.employee_name ?? null,
        employee_code:    emp?.employee_code ?? null,
        in_time:          inTime,
        out_time:         outTime,
        punch_records:    punchRecords,
        missed_in_punch:  missedIn,
        missed_out_punch: missedOut,
        is_on_leave:      false,
        present:          outTime ? 1 : null,
        absent:           0,
        source_db:        `adms:${punches[0].device_sn}`,
        polled_at:        new Date().toISOString(),
      });

      if (insErr) {
        console.error(`[adms] insert attendance for ${key}:`, insErr.message);
      }
    } catch (err) {
      console.error(`[adms] unexpected error processing ${key}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/iclock/cdata?SN=XXX&options=all&pushver=2.4.1
 * Device calls this on boot to get its configuration.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const sn = request.nextUrl.searchParams.get("SN") ?? "unknown";

  if (!isAllowedSN(sn)) {
    console.warn(`[adms] rejected unknown device SN: ${sn}`);
    return error();
  }

  const config = [
    `GET OPTION FROM: ${sn}`,
    "ATTLOGStamp=9999",
    "OPERStamp=9999",
    "ATTPHOTOStamp=9999",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=TransData AttLog OpLog EnrollUser",
    "Realtime=1",
    "Encrypt=0",
  ].join("\r\n");

  // Send IST time as the Date header so the device syncs its clock to IST.
  // Vercel runs in UTC; without this override the device would reset to UTC on
  // every handshake. We lie and label IST as "GMT" — the device treats it as
  // its local clock reference, matching the MDB pipeline convention.
  const istMs = Date.now() + (5 * 60 + 30) * 60 * 1000;
  const istAsGmt = new Date(istMs).toUTCString();

  return new NextResponse(config, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Date": istAsGmt,
    },
  });
}

/**
 * POST /api/iclock/cdata?SN=XXX
 * Device pushes attendance logs here. Must always respond "OK" once the
 * raw punch is saved, regardless of downstream processing outcome.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const sn = request.nextUrl.searchParams.get("SN") ?? "unknown";

  if (!isAllowedSN(sn)) {
    console.warn(`[adms] rejected unknown device SN: ${sn}`);
    return error();
  }

  const { table, lines } = await parseBody(request);

  // Only process attendance logs; silently accept other table types (OPERLOG, etc.)
  if (table !== "ATTLOG") {
    return ok();
  }

  if (lines.length === 0) return ok();

  // Parse lines into punch rows
  // Drop punches older than ADMS_START_DATE (device flushes its full backlog on first connect)
  const startDate = process.env.ADMS_START_DATE?.trim();

  const punches: PunchRow[] = [];
  for (const line of lines) {
    const punch = parseLine(line, sn);
    if (!punch) continue;
    if (startDate && punch.punch_time < startDate) continue;
    punches.push(punch);
  }

  if (punches.length === 0) return ok();

  const supabase = createAdminClient();

  // Save raw punches — UNIQUE constraint handles duplicates silently
  const { error: insertErr } = await supabase
    .from("adms_punches")
    .upsert(punches, {
      onConflict: "user_id,punch_time",
      ignoreDuplicates: true,
    });

  if (insertErr) {
    // Log but still return OK — the device should not keep resending.
    // This is a genuine DB error (not a duplicate), so log it for investigation.
    console.error("[adms] failed to save punches:", insertErr.message);
    return ok();
  }

  console.log(`[adms] saved ${punches.length} punch(es) from SN=${sn}`);

  // Process into attendance (best-effort — errors are logged, not thrown)
  await processIntoAttendance(supabase, punches);

  return ok();
}
