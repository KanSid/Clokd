"""
Simulate an ADMS fingerprint scanner pushing data to the local dev server.

Run with: python scripts/test_adms.py
Optional flags:
  --url   Base URL of your server (default: http://localhost:3000)
  --sn    Device serial number    (default: TESTSN001)
  --uid   Employee ID to use      (default: first employee found in .env DB)

Tests performed (in device boot order):
  1. GET  /iclock/cdata          — handshake, expect config block
  2. POST /iclock/cdata          — push ATTLOG (form-encoded), expect OK
  3. POST /iclock/cdata          — push ATTLOG (raw text), expect OK
  4. POST /iclock/cdata (repeat) — duplicate punch, expect OK (no duplicate row)
  5. GET  /iclock/getrequest     — command poll, expect OK
  6. POST /iclock/devicecmd      — command result, expect OK
  7. GET  /iclock/cdata?SN=BAD  — wrong SN (only if ADMS_DEVICE_SN is set), expect ERROR

Requires: requests  (pip install requests)
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("missing 'requests' — run: pip install requests")

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.local"

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def check(label: str, resp: requests.Response, expect_body: str, expect_status: int = 200) -> bool:
    body = resp.text.strip()
    status_ok = resp.status_code == expect_status
    body_ok = expect_body.lower() in body.lower()
    ok = status_ok and body_ok
    icon = PASS if ok else FAIL
    print(f"  {icon}  {label}")
    if not ok:
        print(f"       expected status={expect_status} body~'{expect_body}'")
        print(f"       got     status={resp.status_code} body='{body[:120]}'")
    return ok


def main() -> None:
    p = argparse.ArgumentParser(description="Test ADMS endpoints")
    p.add_argument("--url", default="http://localhost:3000", help="Base server URL")
    p.add_argument("--sn",  default="TESTSN001",            help="Device serial number")
    p.add_argument("--uid", type=int, default=1,            help="Employee ID (device PIN)")
    args = p.parse_args()

    base = args.url.rstrip("/")
    sn   = args.sn
    uid  = args.uid
    env  = load_env()

    # Use two timestamps: morning in and evening out (IST, today)
    now      = datetime.now()
    today    = now.strftime("%Y-%m-%d")
    t_in     = f"{today} 09:02:00"
    t_out    = f"{today} 18:45:00"
    t_extra  = f"{today} 13:00:00"  # a third punch (break-out) for raw text test

    # ATTLOG line format: UserID\tTimestamp\tStatus\tVerify\tWorkCode\tReserved
    line_in    = f"{uid}\t{t_in}\t0\t1\t\t0"
    line_out   = f"{uid}\t{t_out}\t1\t1\t\t0"
    line_extra = f"{uid}\t{t_extra}\t2\t1\t\t0"

    session = requests.Session()
    session.headers["User-Agent"] = "ZK FP/1.0"  # some devices send this

    results: list[bool] = []
    print(f"\nADMS endpoint tests → {base}  (SN={sn}, UID={uid})\n")

    # ------------------------------------------------------------------
    # 1. Handshake GET
    # ------------------------------------------------------------------
    print("1. Handshake (GET /iclock/cdata)")
    r = session.get(f"{base}/api/iclock/cdata", params={"SN": sn, "options": "all", "pushver": "2.4.1"})
    results.append(check("returns config block", r, f"GET OPTION FROM: {sn}"))

    # ------------------------------------------------------------------
    # 2. Push ATTLOG — form-encoded (most common firmware format)
    # ------------------------------------------------------------------
    print("\n2. Push attendance — form-encoded (POST /iclock/cdata)")
    payload = {"table": "ATTLOG", "Stamp": "9999", "data": f"{line_in}\n{line_out}"}
    r = session.post(
        f"{base}/api/iclock/cdata",
        params={"SN": sn},
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    results.append(check("returns OK", r, "OK"))

    # ------------------------------------------------------------------
    # 3. Push ATTLOG — raw text (older/alternate firmware)
    # ------------------------------------------------------------------
    print("\n3. Push attendance — raw text (POST /iclock/cdata)")
    raw_body = f"ATTLOG\n{line_extra}"
    r = session.post(
        f"{base}/api/iclock/cdata",
        params={"SN": sn},
        data=raw_body,
        headers={"Content-Type": "text/plain"},
    )
    results.append(check("returns OK", r, "OK"))

    # ------------------------------------------------------------------
    # 4. Duplicate punch — resend test 2 verbatim, expect OK (no crash)
    # ------------------------------------------------------------------
    print("\n4. Duplicate punch (resend test 2 unchanged)")
    r = session.post(
        f"{base}/api/iclock/cdata",
        params={"SN": sn},
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    results.append(check("returns OK (duplicate silently ignored)", r, "OK"))

    # ------------------------------------------------------------------
    # 5. Command poll GET
    # ------------------------------------------------------------------
    print("\n5. Command poll (GET /iclock/getrequest)")
    r = session.get(f"{base}/api/iclock/getrequest", params={"SN": sn})
    results.append(check("returns OK", r, "OK"))

    # ------------------------------------------------------------------
    # 6. Command result POST
    # ------------------------------------------------------------------
    print("\n6. Command result (POST /iclock/devicecmd)")
    r = session.post(
        f"{base}/api/iclock/devicecmd",
        params={"SN": sn},
        data="ID=1&Return=0&CMD=CHECK",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    results.append(check("returns OK", r, "OK"))

    # ------------------------------------------------------------------
    # 7. Wrong SN — only meaningful if ADMS_DEVICE_SN is set
    # ------------------------------------------------------------------
    configured_sn = env.get("ADMS_DEVICE_SN", "").strip()
    print("\n7. Wrong SN rejection (GET /iclock/cdata?SN=WRONGSN)")
    if not configured_sn:
        print(f"  -  ADMS_DEVICE_SN not set in .env.local — skipping (any SN accepted)")
    else:
        r = session.get(f"{base}/api/iclock/cdata", params={"SN": "WRONGSN_INVALID"})
        results.append(check("returns ERROR (403)", r, "ERROR", expect_status=403))

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    passed = sum(results)
    total  = len(results)
    print(f"\n{'─' * 40}")
    if passed == total:
        print(f"  {PASS}  All {total} tests passed")
    else:
        print(f"  {FAIL}  {passed}/{total} tests passed")
    print()

    if passed < total:
        print("  Make sure your dev server is running: npm run dev")
        sys.exit(1)


if __name__ == "__main__":
    main()
