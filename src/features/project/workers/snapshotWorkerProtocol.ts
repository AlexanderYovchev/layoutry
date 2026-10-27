import { z } from "zod";
import type { EditorElementNode } from "@/features/editor/types/document";
import { projectMetadataSchema } from "@/features/project/schemas/projectFileSchema";
import { prepareRecoverySnapshot } from "@/features/project/utils/prepareRecoverySnapshot";
import { ProjectSerializationError } from "@/features/project/utils/serializeProject";

/**
 * Messages between the page and the recovery snapshot worker (PROJECT-1.5).
 * Both sides validate what they receive. The document itself is checked
 * the same way as on the page: serializeProject's integrity check and its
 * self-check through the real loader.
 */

const limitsSchema = z.strictObject({
  maxFileCharacters: z.number().int().positive(),
  maxElementNodes: z.number().int().positive(),
  maxElementDepth: z.number().int().positive(),
  maxJsonDepth: z.number().int().positive(),
  maxJsonValues: z.number().int().positive(),
});

function isPlainRecord(value: unknown): value is EditorElementNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const snapshotRequestSchema = z.strictObject({
  id: z.number().int().nonnegative(),
  project: z.strictObject({
    metadata: projectMetadataSchema,
    document: z.custom<EditorElementNode>(isPlainRecord),
  }),
  limits: limitsSchema,
});

export type SnapshotRequest = z.infer<typeof snapshotRequestSchema>;

export const snapshotResponseSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    id: z.number().int().nonnegative(),
    ok: z.literal(true),
    text: z.string(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  z.strictObject({
    id: z.number().int().nonnegative(),
    ok: z.literal(false),
    /**
     * `invalid`: the project can't be written (ProjectSerializationError),
     * exactly as it would fail on the page. `failed`: the worker itself
     * couldn't do the work; the page retries without it.
     */
    reason: z.enum(["invalid", "failed"]),
    message: z.string(),
    path: z.string().optional(),
  }),
]);

export type SnapshotResponse = z.infer<typeof snapshotResponseSchema>;

const requestIdSchema = z.object({ id: z.number().int().nonnegative() });

/**
 * The worker's whole job, kept free of worker globals so it can be tested
 * directly. Returns null for a message without a request id. A request it
 * can't read is answered `failed`, so the page does the work itself and
 * reports any real problem exactly as it would without a worker.
 */
export async function handleSnapshotRequest(
  message: unknown,
  hashText?: (text: string) => Promise<string>,
): Promise<SnapshotResponse | null> {
  const identified = requestIdSchema.safeParse(message);
  if (!identified.success) return null;
  const request = snapshotRequestSchema.safeParse(message);
  if (!request.success)
    return {
      id: identified.data.id,
      ok: false,
      reason: "failed",
      message: "Unreadable snapshot request.",
    };
  const { id, project, limits } = request.data;
  try {
    const prepared = await prepareRecoverySnapshot(project, limits, hashText);
    return { id, ok: true, text: prepared.text, sha256: prepared.sha256 };
  } catch (error) {
    if (error instanceof ProjectSerializationError)
      return {
        id,
        ok: false,
        reason: "invalid",
        message: error.message,
        ...(error.path === undefined ? {} : { path: error.path }),
      };
    return {
      id,
      ok: false,
      reason: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
