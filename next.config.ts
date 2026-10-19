import type { NextConfig } from "next";

// Desktop builds (ADR-0002) need a static export that the Electron shell
// serves over app://layoutry/. Only desktop/scripts/build-frontend.mjs sets
// this flag; every other build keeps Next's default output unchanged.
const isDesktopBuild = process.env.LAYOUTRY_DESKTOP_BUILD === "1";

const nextConfig: NextConfig = isDesktopBuild ? { output: "export" } : {};

export default nextConfig;
