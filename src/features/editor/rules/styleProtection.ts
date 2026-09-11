import { findAncestorChain } from "@/features/editor/utils/findNodeById";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Parent Style Protection (Checkpoint 1.15.3) — the single centralized
 * source every style-mutating store action, resize/Free-move session, and
 * Inspector CSS section reads to decide "is this node currently allowed to
 * receive an authored style change." Deliberately its own small rules
 * module, the same "one shared helper, never duplicated ancestor-check
 * logic per call site" precedent intersectElementCapabilities already set
 * in this same directory for Checkpoint 1.15.2.
 *
 * Ownership tags recommended by this checkpoint's own brief (section 9) —
 * ordinary layout/content-grouping containers where "lock my children's
 * styling" reads as an obviously useful product action. This list gates
 * ONLY the Inspector's "Lock child styles" toggle visibility, never the
 * underlying protection mechanism itself: findNearestStyleLockingAncestor
 * below honors `lockChildStyles` on ANY tag, so a future checkpoint can
 * widen this list (e.g. exposing it on Table/Select too) with zero changes
 * to the enforcement layer, only to this one set.
 */
const STYLE_LOCK_OWNER_TAGS: ReadonlySet<string> = new Set([
  "div",
  "section",
  "header",
  "nav",
  "main",
  "article",
  "aside",
  "footer",
  "form",
  "label",
]);

export function canOwnStyleLock(tag: string): boolean {
  return STYLE_LOCK_OWNER_TAGS.has(tag);
}

/**
 * The most actionable ancestor to report to the user — the CLOSEST
 * locking ancestor, not the outermost one, so a nested-locks selection
 * (section 61's own worked example) always names the lock the user
 * actually needs to open. Ancestors only, never nodeId itself (section 8
 * — a lock owner is never protected by its own lock): findAncestorChain
 * already starts at the immediate PARENT and excludes nodeId, so no
 * additional exclusion is needed here. Returns undefined for a deleted/
 * invalid nodeId the same way findAncestorChain itself does (an empty
 * chain), satisfying section 48's "deleted/invalid ID → safe result" case.
 */
export function findNearestStyleLockingAncestor(
  document: EditorElementNode,
  nodeId: string,
): EditorElementNode | undefined {
  return findAncestorChain(document, nodeId).find((ancestor) => ancestor.lockChildStyles === true);
}

export type StyleProtectionResult =
  | { protected: false }
  | { protected: true; lockingAncestor: EditorElementNode };

export function getStyleProtection(document: EditorElementNode, nodeId: string): StyleProtectionResult {
  const lockingAncestor = findNearestStyleLockingAncestor(document, nodeId);
  return lockingAncestor ? { protected: true, lockingAncestor } : { protected: false };
}

export function isStyleProtected(document: EditorElementNode, nodeId: string): boolean {
  return getStyleProtection(document, nodeId).protected;
}

/**
 * The readable identity used in every protection notice (section 19) —
 * authored HTML ID first (what the user themselves named this container),
 * then the ordinary Structure/display name, exactly the priority the brief
 * specifies. Never falls back to the internal editor UUID.
 */
export function getReadableNodeName(node: EditorElementNode): string {
  const trimmedHtmlId = node.htmlId?.trim();
  return trimmedHtmlId ? trimmedHtmlId : getElementDisplayName(node);
}

/**
 * Builds the one user-facing sentence for a blocked style-mutation attempt
 * (sections 18-19), for both a single-target attempt and an atomically-
 * blocked bulk attempt. `protections` may contain a mix of protected/
 * unprotected results (a bulk caller passes every targeted node's own
 * result) — only the protected ones are considered. When every protected
 * target shares one nearest locking ancestor, that ancestor is named
 * directly; when they're protected by genuinely different ancestors, one
 * generic message is shown instead of naming several parents at once
 * (section 18 — never flood the user with per-target detail). Returns
 * empty string if nothing in `protections` is actually protected — callers
 * only ever invoke this once they already know at least one target was
 * blocked.
 */
export function describeStyleLockNotice(protections: readonly StyleProtectionResult[], isBulk: boolean): string {
  const lockingAncestors = protections
    .filter((result): result is Extract<StyleProtectionResult, { protected: true }> => result.protected)
    .map((result) => result.lockingAncestor);

  if (lockingAncestors.length === 0) return "";

  const uniqueAncestorIds = new Set(lockingAncestors.map((ancestor) => ancestor.id));
  if (uniqueAncestorIds.size > 1) {
    return "Some selected elements have locked styles. Unlock their parent containers before applying this change.";
  }

  const name = getReadableNodeName(lockingAncestors[0]);
  const subject = isBulk ? "this selection" : "this element";
  return `Styles are locked by "${name}". Disable "Lock child styles" on the parent to edit ${subject}.`;
}
