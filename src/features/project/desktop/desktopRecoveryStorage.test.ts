import { describe, expect, it, vi } from "vitest";
import { createDesktopRecoveryStorage } from "@/features/project/desktop/desktopRecoveryStorage";
import { RecoveryStorageError } from "@/features/project/storage/recoveryStorage";

/** PROJECT-1.4: the renderer validates everything the desktop bridge returns. */

const SESSION = "a".repeat(32);

function bridge(overrides: Record<string, unknown> = {}) {
  return {
    beginRecoverySession: vi.fn(async () => ({ sessionId: SESSION })),
    writeRecoverySnapshot: vi.fn(async () => ({
      status: "written",
      recordId: `${SESSION}-1`,
    })),
    listRecovery: vi.fn(async () => ({ status: "ok", entries: [] })),
    readRecovery: vi.fn(async () => ({
      status: "error",
      error: { code: "not-found", message: "gone" },
    })),
    discardRecovery: vi.fn(async () => ({ status: "ok", removed: 0 })),
    ...overrides,
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof RecoveryStorageError))
    throw new Error(`expected a RecoveryStorageError, got ${String(error)}`);
  return error.code;
}

const write = {
  generation: 1,
  metadata: {
    id: "p",
    name: "P",
    createdAt: "2026-10-28T09:00:00.000Z",
    updatedAt: "2026-10-28T09:00:00.000Z",
  },
  source: {
    kind: "file" as const,
    fileName: "P.layoutry",
    token: "f".repeat(32),
  },
  savedAt: "2026-10-28T09:00:00.000Z",
  sha256: "0".repeat(64),
  text: "{}",
};

describe("desktop recovery storage", () => {
  it("is null in a browser or with an incomplete bridge", () => {
    expect(createDesktopRecoveryStorage(undefined)).toBeNull();
    expect(
      createDesktopRecoveryStorage({ ...bridge(), listRecovery: undefined }),
    ).toBeNull();
  });

  it("sends only the snapshot fields the main process validates", async () => {
    const raw = bridge();
    const storage = createDesktopRecoveryStorage(raw);
    await storage?.write(write);
    expect(raw.writeRecoverySnapshot).toHaveBeenCalledWith({
      generation: 1,
      source: write.source,
      sha256: write.sha256,
      text: "{}",
    });
  });

  it("maps refusals to recovery errors", async () => {
    const storage = createDesktopRecoveryStorage(
      bridge({
        writeRecoverySnapshot: async () => ({ status: "stale" }),
        listRecovery: async () => ({
          status: "error",
          error: { code: "disk-full", message: "No space." },
        }),
      }),
    );
    if (!storage) throw new Error("no storage");
    expect(await codeOf(storage.write(write))).toBe("stale");
    expect(await codeOf(storage.listOrphans())).toBe("quota-exceeded");
    expect(
      await codeOf(storage.read(`${SESSION}-1`, { forRestore: false })),
    ).toBe("not-found");
  });

  it("treats malformed results and a broken bridge as unavailable", async () => {
    const storage = createDesktopRecoveryStorage(
      bridge({
        beginRecoverySession: async () => ({ sessionId: "../not-an-id" }),
        listRecovery: async () => ({
          status: "ok",
          entries: [{ status: "ok", summary: { recordId: "x" } }],
        }),
        readRecovery: () => {
          throw new Error("IPC failed");
        },
      }),
    );
    if (!storage) throw new Error("no storage");
    expect(await codeOf(storage.beginSession())).toBe("unavailable");
    expect(await codeOf(storage.listOrphans())).toBe("unavailable");
    expect(
      await codeOf(storage.read(`${SESSION}-1`, { forRestore: true })),
    ).toBe("unavailable");
  });
});
