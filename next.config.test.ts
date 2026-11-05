// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return (await import("./next.config")).default;
}

describe("next.config build mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps Next's default output for the normal browser build", async () => {
    vi.stubEnv("LAYOUTRY_DESKTOP_BUILD", undefined);
    const config = await loadConfig();
    expect(config.output).toBeUndefined();
    expect(Object.keys(config)).toEqual(["headers"]);
  });

  it("BC-02.3: the web build refuses to be framed, by anyone (frame-ancestors 'none' + X-Frame-Options DENY)", async () => {
    vi.stubEnv("LAYOUTRY_DESKTOP_BUILD", undefined);
    const config = await loadConfig();
    expect(await config.headers?.()).toEqual([
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ]);
  });

  it("BC-02.3: the desktop static export sends no headers (the Electron shell sets its own CSP)", async () => {
    vi.stubEnv("LAYOUTRY_DESKTOP_BUILD", "1");
    const config = await loadConfig();
    expect(config.headers).toBeUndefined();
  });

  it("switches to a static export for the desktop build", async () => {
    vi.stubEnv("LAYOUTRY_DESKTOP_BUILD", "1");
    const config = await loadConfig();
    expect(config.output).toBe("export");
  });

  it.each(["0", "true", "yes", ""])(
    "ignores the non-canonical flag value %j",
    async (value) => {
      vi.stubEnv("LAYOUTRY_DESKTOP_BUILD", value);
      const config = await loadConfig();
      expect(config.output).toBeUndefined();
    },
  );
});
