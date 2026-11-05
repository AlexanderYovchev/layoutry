import type { NextConfig } from "next";

// Desktop builds (ADR-0002) need a static export that the Electron shell
// serves over app://layoutry/. Only desktop/scripts/build-frontend.mjs sets
// this flag; every other build keeps Next's default output unchanged.
const isDesktopBuild = process.env.LAYOUTRY_DESKTOP_BUILD === "1";

// The web editor may never be framed, not even by itself (BC-02.3). An
// authored embed is sandboxed, but a cross-origin embed that redirects
// back to the editor's origin would otherwise load the editor inside the
// frame with that origin and full access to the editor around it. This is
// the web build's counterpart of the desktop CSP's frame-ancestors 'none'
// (desktop/security/contentSecurityPolicy.ts); a static export cannot send
// headers, so the desktop shell sets its own.
const webSecurityHeaders: NextConfig["headers"] = async () => [
  {
    source: "/:path*",
    headers: [
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
    ],
  },
];

const nextConfig: NextConfig = isDesktopBuild ? { output: "export" } : { headers: webSecurityHeaders };

export default nextConfig;
