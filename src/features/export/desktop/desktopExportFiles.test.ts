import { describe, expect, it, vi } from "vitest";
import { createDesktopExportFiles, getDesktopExportFiles } from "@/features/export/desktop/desktopExportFiles";

describe("desktop export bridge", () => {
  it("is absent in a browser and when the bridge lacks the export functions", () => {
    expect(getDesktopExportFiles()).toBeNull();
    expect(createDesktopExportFiles(undefined)).toBeNull();
    expect(createDesktopExportFiles({ chooseExportDestination: () => undefined })).toBeNull();
  });

  it("sends only each file's name and text, and returns validated results", async () => {
    const raw = {
      chooseExportDestination: vi.fn(async () => ({ status: "chosen", destination: { token: "t", label: "Site" } })),
      writeExportFiles: vi.fn(async () => ({ status: "saved", label: "Site", fileNames: ["index.html"] })),
    };
    const bridge = createDesktopExportFiles(raw);
    if (!bridge) throw new Error("no bridge");
    expect(await bridge.chooseExportDestination("separate", "Site")).toEqual({ status: "chosen", destination: { token: "t", label: "Site" } });
    expect(raw.chooseExportDestination).toHaveBeenCalledWith("separate", "Site");
    const file = { path: "index.html", content: "<p>", mediaType: "text/html" };
    await bridge.writeExportFiles("t", [file], false);
    expect(raw.writeExportFiles).toHaveBeenCalledWith("t", [{ path: "index.html", content: "<p>" }], false);
  });

  it("turns malformed results and failed calls into an honest error", async () => {
    const bridge = createDesktopExportFiles({
      chooseExportDestination: async () => ({ status: "chosen", destination: { token: 5 } }),
      writeExportFiles: async () => {
        throw new Error("ipc down");
      },
    });
    if (!bridge) throw new Error("no bridge");
    expect(await bridge.chooseExportDestination("standalone", "index.html")).toMatchObject({ status: "error", error: { code: "bridge" } });
    expect(await bridge.writeExportFiles("t", [], false)).toMatchObject({
      status: "error",
      error: { code: "bridge", message: expect.stringContaining("Nothing was saved") },
    });
  });
});
