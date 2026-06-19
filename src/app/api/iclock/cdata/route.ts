/**
 * ADMS fingerprint scanner receiver — /api/iclock/cdata
 *
 * GET  — device handshake on boot; returns plain-text config options
 * POST — device pushes attendance logs (ATTLOG); raw punches are saved to
 *        adms_punches. A DB trigger (adms_punch_to_attendance) resolves the
 *        employee and upserts the attendance row automatically.
 *
 * The device MUST receive a plain-text "OK" response to clear its local
 * buffer. Always return OK as long as the raw punch was saved.
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
  if (!allowed) return true;
  return allowed.split(",").map((s) => s.trim()).includes(sn);
}

/**
 * Convert a device timestamp ("YYYY-MM-DD HH:MM:SS") to a Postgres ISO string.
 *
 * The device applies TimeZone=330 (IST offset) to the UTC clock from the server,
 * so it sends IST timestamps. We store them as-is with +00:00 — Postgres labels
 * them UTC but values are IST, matching the MDB pipeline convention.
 */
function deviceTimeToISO(raw: string): string | null {
  if (!raw.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) return null;
  try {
    return new Date(`${raw.replace(" ", "T")}+00:00`).toISOString();
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
  punch_time: string; // ISO, stored as IST-labeled +00
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

  // TimeZone=330 (minutes) = IST (UTC+5:30). The device applies this offset to
  // the UTC clock it receives from the server's Date header, so it displays IST
  // and sends IST timestamps in ATTLOG — consistent with the MDB pipeline convention.
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
    "TimeZone=330",
    "Realtime=1",
    "Encrypt=0",
  ].join("\r\n");

  return new NextResponse(config, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * POST /api/iclock/cdata?SN=XXX
 * Device pushes attendance logs here. Saves raw punches to adms_punches;
 * the DB trigger handles employee resolution and attendance upsert.
 * Always responds "OK" once the raw punch is saved.
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

  // Save raw punches — DB trigger fires on each new row to update attendance.
  // UNIQUE constraint on (user_id, punch_time) silently drops duplicates.
  const { error: insertErr } = await supabase
    .from("adms_punches")
    .upsert(punches, {
      onConflict: "user_id,punch_time",
      ignoreDuplicates: true,
    });

  if (insertErr) {
    console.error("[adms] failed to save punches:", insertErr.message);
  } else {
    console.log(`[adms] saved ${punches.length} punch(es) from SN=${sn}`);
  }

  return ok();
}
