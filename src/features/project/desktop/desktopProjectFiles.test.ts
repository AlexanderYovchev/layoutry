import { describe, expect, it, vi } from "vitest";
import {
  createDesktopProjectFiles,
  getDesktopProjectFiles,
} from "@/features/project/desktop/desktopProjectFiles";

function rawBridge(overrides: Record<string, unknown> = {}) {
  return {
    openProjectFile: vi.fn(async () => ({ status: "cancelled" })),
    takePendingProjectFile: vi.fn(async () => ({ status: "none" })),
    chooseSaveLocation: vi.fn(async () => ({ status: "cancelled" })),
    writeProjectFile: vi.fn(async () => ({
      status: "saved",
      fileName: "a.layoutry",
    })),
    releaseProjectFile: vi.fn(async () => undefined),
    setUnsavedChanges: vi.fn(async () => undefined),
    respondToCloseRequest: vi.fn(async () => undefined),
    onCloseRequested: vi.fn(() => () => undefined),
    onPendingProjectFile: vi.fn(() => () => undefined),
    ...overrides,
  };
}

describe("desktop bridge adapter", () => {
  it("is absent in a browser", () => {
    expect(getDesktopProjectFiles()).toBeNull();
  });

  it.each([null, undefined, 42, {}, { openProjectFile: () => undefined }])(
    "ignores anything that isn't the complete bridge (%j)",
    (raw) => {
      expect(createDesktopProjectFiles(raw)).toBeNull();
    },
  );

  it("passes valid results through", async () => {
    const files = createDesktopProjectFiles(rawBridge());
    expect(await files?.writeProjectFile("t", "x", false)).toEqual({
      status: "saved",
      fileName: "a.layoutry",
    });
  });

  it("turns a malformed result into a safe error instead of trusting it", async () => {
    const files = createDesktopProjectFiles(
      rawBridge({
        openProjectFile: async () => ({ status: "opened", file: { token: 1 } }),
      }),
    );
    expect(await files?.openProjectFile()).toMatchObject({
      status: "error",
      error: { code: "bridge" },
    });
  });

  it("turns a rejected call (e.g. a refused payload) into an error result", async () => {
    const files = createDesktopProjectFiles(
      rawBridge({
        chooseSaveLocation: async () =>
          Promise.reject(new Error("Rejected desktop IPC payload")),
      }),
    );
    expect(await files?.chooseSaveLocation("x")).toMatchObject({
      status: "error",
    });
  });

  it("never lets a fire-and-forget call throw into the editor", () => {
    const files = createDesktopProjectFiles(
      rawBridge({ setUnsavedChanges: () => Promise.reject(new Error("gone")) }),
    );
    expect(() => files?.setUnsavedChanges(true)).not.toThrow();
  });
});
