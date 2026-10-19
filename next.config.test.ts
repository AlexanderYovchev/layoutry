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
    expect(config).toEqual({});
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
