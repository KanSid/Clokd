/**
 * ADMS command result — /api/iclock/devicecmd
 *
 * POST — device posts the result of a command it executed (e.g. the outcome
 *        of a user-enroll or delete command we queued via getrequest).
 *        Since we have no command queue, we simply acknowledge and move on.
 *
 * Auth: same SN validation as /api/iclock/cdata.
 */

import { NextRequest, NextResponse } from "next/server";

function isAllowedSN(sn: string): boolean {
  const allowed = process.env.ADMS_DEVICE_SN?.trim();
  if (!allowed) return true;
  return allowed.split(",").map((s) => s.trim()).includes(sn);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sn = request.nextUrl.searchParams.get("SN") ?? "unknown";

  if (!isAllowedSN(sn)) {
    console.warn(`[adms/devicecmd] rejected unknown device SN: ${sn}`);
    return new NextResponse("ERROR", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Log for future debugging if we ever implement a command queue
  const body = await request.text();
  if (body) {
    console.log(`[adms/devicecmd] SN=${sn} result: ${body.slice(0, 200)}`);
  }

  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
