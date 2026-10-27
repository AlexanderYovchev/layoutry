import { z } from "zod";
import { PROJECT_ID_PATTERN } from "@/features/project/schemas/projectFileSchema";
import {
  CURRENT_RECOVERY_RECORD_VERSION,
  RECOVERY_RECORD_FORMAT,
  RECOVERY_RECORD_ID_PATTERN,
  RECOVERY_SESSION_ID_PATTERN,
  type RecoveryListEntry,
  type RecoveryRecordSummary,
} from "@/features/project/types/recoveryRecord";

/**
 * Validation for recovery records (PROJECT-1.4): what the browser reads
 * back from IndexedDB, and what the desktop bridge returns. Both are
 * external data.
 */

export const recoverySourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("unsaved") }),
  z.strictObject({
    kind: z.literal("library"),
    revision: z.string().max(64),
  }),
  z.strictObject({ kind: z.literal("file"), fileName: z.string().max(260) }),
]);

const summaryFields = {
  recordId: z.string().regex(RECOVERY_RECORD_ID_PATTERN),
  sessionId: z.string().regex(RECOVERY_SESSION_ID_PATTERN),
  generation: z.number().int().min(1).max(999_999_999),
  projectId: z.string().regex(PROJECT_ID_PATTERN),
  projectName: z.string().max(256),
  savedAt: z.iso.datetime(),
  source: recoverySourceSchema,
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
};

export const recoverySummarySchema = z
  .strictObject({
    ...summaryFields,
    original: z
      .enum(["unchanged", "modified", "missing", "unavailable"])
      .nullable(),
  })
  .refine(
    (summary) =>
      summary.recordId === `${summary.sessionId}-${summary.generation}`,
    { message: "record id doesn't match its session and generation" },
  );

/** The record as the browser stores it in the `summaries` store. */
export const storedRecoverySummarySchema = z
  .strictObject({
    ...summaryFields,
    format: z.literal(RECOVERY_RECORD_FORMAT),
    recoveryVersion: z.literal(CURRENT_RECOVERY_RECORD_VERSION),
  })
  .refine(
    (summary) =>
      summary.recordId === `${summary.sessionId}-${summary.generation}`,
    { message: "record id doesn't match its session and generation" },
  );

export type StoredRecoverySummary = z.infer<typeof storedRecoverySummarySchema>;

export const recoveryListEntrySchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("ok"), summary: recoverySummarySchema }),
  z.strictObject({
    status: z.literal("damaged"),
    recordId: z.string().regex(RECOVERY_RECORD_ID_PATTERN),
    sessionId: z.string().regex(RECOVERY_SESSION_ID_PATTERN),
    reason: z.enum(["unreadable", "unsupported-version"]),
  }),
]);

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function assertSameType<Condition extends true>(): Condition | undefined {
  return undefined;
}
assertSameType<
  Equal<z.infer<typeof recoverySummarySchema>, RecoveryRecordSummary>
>();
assertSameType<
  Equal<z.infer<typeof recoveryListEntrySchema>, RecoveryListEntry>
>();
