import { z } from "zod";
import {
  recoveryListEntrySchema,
  recoverySummarySchema,
} from "@/features/project/schemas/recoveryRecordSchema";
import {
  RecoveryStorageError,
  type RecoveryStorage,
  type RecoveryStorageErrorCode,
} from "@/features/project/storage/recoveryStorage";

/**
 * Desktop recovery snapshots (PROJECT-1.4) over the preload bridge: the
 * main process writes them to the app-owned Recovery folder in the
 * profile (desktop/recovery/). Sessions are created and tracked by the
 * main process; only one editor window exists, so claims always succeed.
 * Every result is validated — the bridge is external data like any other.
 */

const errorSchema = z.object({ code: z.string(), message: z.string() });
const errorResultSchema = z.object({
  status: z.literal("error"),
  error: errorSchema,
});

const beginResultSchema = z.object({
  sessionId: z.string().regex(/^[0-9a-f]{32}$/),
});
const writeResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("written"), recordId: z.string() }),
  z.object({ status: z.literal("stale") }),
  errorResultSchema,
]);
const listResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    entries: z.array(recoveryListEntrySchema).max(10_000),
  }),
  errorResultSchema,
]);
const readResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    summary: recoverySummarySchema,
    text: z.string(),
    file: z
      .object({
        token: z.string().regex(/^[0-9a-f]{32}$/),
        fileName: z.string(),
      })
      .nullable(),
    matchesOriginal: z.boolean(),
  }),
  errorResultSchema,
]);
const discardResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), removed: z.number() }),
  errorResultSchema,
]);

const BRIDGE_FUNCTIONS = [
  "beginRecoverySession",
  "writeRecoverySnapshot",
  "listRecovery",
  "readRecovery",
  "discardRecovery",
] as const;

type RawRecoveryBridge = Record<
  (typeof BRIDGE_FUNCTIONS)[number],
  (...args: unknown[]) => unknown
>;

function isRawRecoveryBridge(value: unknown): value is RawRecoveryBridge {
  if (typeof value !== "object" || value === null) return false;
  return BRIDGE_FUNCTIONS.every(
    (name) => typeof Reflect.get(value, name) === "function",
  );
}

const CODES: Record<string, RecoveryStorageErrorCode> = {
  unavailable: "unavailable",
  "no-session": "unavailable",
  "permission-denied": "unavailable",
  "disk-full": "quota-exceeded",
  "not-found": "not-found",
  damaged: "damaged",
  "unsupported-version": "unsupported-version",
  "in-use": "in-use",
};

const BRIDGE_FAILURE = new RecoveryStorageError(
  "unavailable",
  "Layoutry couldn't reach its recovery service. Save your work to keep it.",
);

async function call<T>(
  schema: z.ZodType<T>,
  invoke: () => unknown,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await invoke();
  } catch {
    throw BRIDGE_FAILURE;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw BRIDGE_FAILURE;
  return parsed.data;
}

function fail(error: { code: string; message: string }): never {
  throw new RecoveryStorageError(CODES[error.code] ?? "failed", error.message);
}

export function createDesktopRecoveryStorage(
  raw: unknown,
): RecoveryStorage | null {
  if (!isRawRecoveryBridge(raw)) return null;
  return {
    async beginSession() {
      return (await call(beginResultSchema, () => raw.beginRecoverySession()))
        .sessionId;
    },

    async write(snapshot) {
      const result = await call(writeResultSchema, () =>
        raw.writeRecoverySnapshot({
          generation: snapshot.generation,
          source: snapshot.source,
          sha256: snapshot.sha256,
          text: snapshot.text,
        }),
      );
      if (result.status === "stale")
        throw new RecoveryStorageError(
          "stale",
          "A newer recovery copy already exists.",
        );
      if (result.status === "error") fail(result.error);
    },

    async listOrphans() {
      const result = await call(listResultSchema, () => raw.listRecovery());
      if (result.status === "error") fail(result.error);
      return result.entries;
    },

    async read(recordId, { forRestore }) {
      const result = await call(readResultSchema, () =>
        raw.readRecovery(recordId, forRestore),
      );
      if (result.status === "error") fail(result.error);
      return {
        summary: result.summary,
        text: result.text,
        file: result.file,
        matchesOriginal: result.matchesOriginal,
      };
    },

    async remove(recordIds) {
      if (recordIds.length === 0) return;
      const result = await call(discardResultSchema, () =>
        raw.discardRecovery([...recordIds]),
      );
      if (result.status === "error") fail(result.error);
    },

    async claim(sessionIds) {
      return [...sessionIds];
    },

    release() {},
  };
}

/** The desktop app's recovery storage, or null in a browser. */
export function getDesktopRecoveryStorage(): RecoveryStorage | null {
  if (typeof window === "undefined") return null;
  return createDesktopRecoveryStorage(Reflect.get(window, "layoutryDesktop"));
}
