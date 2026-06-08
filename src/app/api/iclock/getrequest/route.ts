/**
 * ADMS command poll — /api/iclock/getrequest
 *
 * GET — device calls this after every push to check if the server has
 *       queued commands (e.g. enroll a new user, delete a user, sync time).
 *       We have no command queue, so we always respond "OK".
 *
 * Auth: same SN validation as /api/iclock/cdata.
 */

import { NextRequest, NextResponse } from "next/server";

function isAllowedSN(sn: string): boolean {
  const allowed = process.env.ADMS_DEVICE_SN?.trim();
  if (!allowed) return true;
  return allowed.split(",").map((s) => s.trim()).includes(sn);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sn = request.nextUrl.searchParams.get("SN") ?? "unknown";

  if (!isAllowedSN(sn)) {
    console.warn(`[adms/getrequest] rejected unknown device SN: ${sn}`);
    return new NextResponse("ERROR", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // No commands queued — device will continue its normal push cycle
  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
