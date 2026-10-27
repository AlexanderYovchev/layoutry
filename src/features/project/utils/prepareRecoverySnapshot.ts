import type { ProjectLimits } from "@/features/project/rules/projectLimits";
import type { LayoutryProject } from "@/features/project/types/projectFile";
import { serializeProject } from "@/features/project/utils/serializeProject";
import { sha256Hex } from "@/features/project/utils/sha256Hex";

/** A recovery snapshot ready to store: the canonical text and its SHA-256. */
export interface PreparedSnapshot {
  text: string;
  sha256: string;
}

/**
 * Turns captured state into a recovery snapshot (PROJECT-1.4/1.5): the
 * canonical `.layoutry` text — with serializeProject's full self-check
 * through the real loader — and the SHA-256 of its UTF-8 bytes. Throws
 * ProjectSerializationError like serializeProject.
 *
 * The same function runs in the snapshot worker and, where no worker is
 * available, on the page itself, so both produce identical records.
 */
export async function prepareRecoverySnapshot(
  project: LayoutryProject,
  limits: ProjectLimits,
  hashText: (text: string) => Promise<string> = sha256Hex,
): Promise<PreparedSnapshot> {
  const text = serializeProject(project, limits);
  return { text, sha256: await hashText(text) };
}

/** Prepares snapshots, wherever the work happens. */
export type SnapshotPreparer = (
  project: LayoutryProject,
  limits: ProjectLimits,
) => Promise<PreparedSnapshot>;
