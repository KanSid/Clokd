import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent browsers from MIME-sniffing the content type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block the page from being embedded in an iframe (clickjacking protection)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Control how much referrer info is sent with requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict access to browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Content Security Policy — restrict resource origins
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for its runtime styles; nonces are
      // the stricter alternative but require middleware integration.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      // Allow connections to Supabase (REST, Auth, Realtime)
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // ADMS fingerprint scanners hardcode the path prefix /iclock/* and cannot
  // be changed. This rewrite silently maps the device's calls to our API routes.
  // Device calls:  POST /iclock/cdata        → /api/iclock/cdata
  //                GET  /iclock/getrequest   → /api/iclock/getrequest
  //                POST /iclock/devicecmd    → /api/iclock/devicecmd
  async rewrites() {
    return [
      {
        source: "/iclock/:path*",
        destination: "/api/iclock/:path*",
      },
    ];
  },
};

export default nextConfig;
