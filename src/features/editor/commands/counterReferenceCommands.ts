import {
  counterOperationRefs,
  generateCounterId,
  MAX_COUNTER_DEFINITIONS,
  type CopiedCounterContext,
  type CounterDefinition,
  type CounterOperations,
  type CounterRef,
} from "@/features/editor/types/counters";
import type { EditorElementNode } from "@/features/editor/types/document";
import { normalizeAssetName } from "@/features/editor/types/styleAssets";
import type {
  ContentPart,
  StyleRule,
} from "@/features/editor/types/styleRules";

/**
 * BC-17.2 — counter references across copy and paste (P-4; BC-17.1.3
 * Report 1 §4.11.5). A copied element keeps referencing counter
 * definitions by id; the definitions themselves live on the document root.
 * So the element clipboard carries the definitions its subtrees reference,
 * and a paste reconciles them with the destination:
 *
 * - SAME document (same session document id): references keep their ids,
 *   so a copied step continues the same sequence. A definition deleted
 *   since the copy is recreated from the clipboard with its id.
 * - FOREIGN document: each definition maps to the destination definition
 *   with the same normalized name (a deliberate, visible reuse), or is
 *   created with a fresh id.
 *
 * Either way, no pasted reference can dangle. Pure; the caller records
 * the result as part of the paste's single history entry.
 */

function nodeCounterIds(node: EditorElementNode, ids: Set<string>): void {
  const add = (refs: readonly CounterRef[]) => {
    for (const ref of refs) if (ref.kind === "document") ids.add(ref.id);
  };
  add(counterOperationRefs(node.counters));
  for (const rule of node.styleRules ?? []) {
    add(counterOperationRefs(rule.groups.counters));
    if (rule.content?.kind === "parts")
      add(
        rule.content.parts.flatMap((part) =>
          part.kind === "counter" || part.kind === "counters"
            ? [part.counter]
            : [],
        ),
      );
  }
  for (const child of node.children ?? []) nodeCounterIds(child, ids);
}

/** The ids of every document counter the subtrees reference. */
export function referencedCounterIds(
  roots: readonly EditorElementNode[],
): Set<string> {
  const ids = new Set<string>();
  for (const root of roots) nodeCounterIds(root, ids);
  return ids;
}

/** The copy-time context for the element clipboard. */
export function copiedCounterContext(
  document: EditorElementNode,
  roots: readonly EditorElementNode[],
  documentSessionId: number,
): CopiedCounterContext {
  const ids = referencedCounterIds(roots);
  return {
    sourceDocumentSessionId: documentSessionId,
    counters: (document.styleAssets?.counters ?? []).filter((definition) =>
      ids.has(definition.id),
    ),
  };
}

function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(normalizeAssetName(name))) return name;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${name} (${suffix})`;
    if (!taken.has(normalizeAssetName(candidate))) return candidate;
  }
}

function remapRef(
  ref: CounterRef,
  map: ReadonlyMap<string, string>,
): CounterRef {
  if (ref.kind !== "document") return ref;
  const id = map.get(ref.id);
  return id === undefined || id === ref.id ? ref : { kind: "document", id };
}

function remapOperations(
  operations: CounterOperations | undefined,
  map: ReadonlyMap<string, string>,
): CounterOperations | undefined {
  if (!operations) return operations;
  const remapList = (list: CounterOperations["reset"]) =>
    list?.map((operation) => ({
      ...operation,
      counter: remapRef(operation.counter, map),
    }));
  return {
    ...(operations.reset ? { reset: remapList(operations.reset) } : {}),
    ...(operations.increment
      ? { increment: remapList(operations.increment) }
      : {}),
    ...(operations.set ? { set: remapList(operations.set) } : {}),
  };
}

function remapPart(
  part: ContentPart,
  map: ReadonlyMap<string, string>,
): ContentPart {
  return part.kind === "counter" || part.kind === "counters"
    ? { ...part, counter: remapRef(part.counter, map) }
    : part;
}

function remapRule(
  rule: StyleRule,
  map: ReadonlyMap<string, string>,
): StyleRule {
  return {
    ...rule,
    groups: rule.groups.counters
      ? { ...rule.groups, counters: remapOperations(rule.groups.counters, map) }
      : rule.groups,
    ...(rule.content?.kind === "parts"
      ? {
          content: {
            ...rule.content,
            parts: rule.content.parts.map((part) => remapPart(part, map)),
          },
        }
      : {}),
  };
}

function remapSubtree(
  node: EditorElementNode,
  map: ReadonlyMap<string, string>,
): EditorElementNode {
  return {
    ...node,
    ...(node.counters ? { counters: remapOperations(node.counters, map) } : {}),
    ...(node.styleRules
      ? { styleRules: node.styleRules.map((rule) => remapRule(rule, map)) }
      : {}),
    ...(node.children
      ? { children: node.children.map((child) => remapSubtree(child, map)) }
      : {}),
  };
}

function remapPastedRoots(
  node: EditorElementNode,
  rootIds: ReadonlySet<string>,
  map: ReadonlyMap<string, string>,
): EditorElementNode {
  if (rootIds.has(node.id)) return remapSubtree(node, map);
  if (!node.children) return node;
  let changed = false;
  const children = node.children.map((child) => {
    const next = remapPastedRoots(child, rootIds, map);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...node, children } : node;
}

/** A paste that would take the document past the counter-definition bound is refused (nothing changes). */
export function exceedsCounterDefinitionLimit(
  document: EditorElementNode,
): boolean {
  return (
    (document.styleAssets?.counters?.length ?? 0) > MAX_COUNTER_DEFINITIONS
  );
}

export const COUNTER_LIMIT_PASTE_NOTICE = `Nothing was pasted: the project would have more than ${MAX_COUNTER_DEFINITIONS} counters.`;

/**
 * Makes every counter reference in the pasted roots resolve in `document`
 * (the document AFTER the pasted roots were inserted). Returns the same
 * object when nothing referenced a counter.
 */
export function reconcilePastedCounters(
  document: EditorElementNode,
  pastedRootIds: readonly string[],
  context: CopiedCounterContext | undefined,
  destinationSessionId: number,
): EditorElementNode {
  const rootIds = new Set(pastedRootIds);
  const pastedRoots: EditorElementNode[] = [];
  const collect = (node: EditorElementNode) => {
    if (rootIds.has(node.id)) pastedRoots.push(node);
    else node.children?.forEach(collect);
  };
  collect(document);
  const referenced = referencedCounterIds(pastedRoots);
  if (referenced.size === 0) return document;

  const existing = document.styleAssets?.counters ?? [];
  const existingIds = new Set(existing.map((definition) => definition.id));
  const taken = new Set(
    existing.map((definition) => normalizeAssetName(definition.name)),
  );
  const sameDocument =
    context?.sourceDocumentSessionId === destinationSessionId;
  const additions: CounterDefinition[] = [];
  const map = new Map<string, string>();

  for (const id of referenced) {
    if (sameDocument && existingIds.has(id)) continue;
    const copied = context?.counters.find(
      (definition) => definition.id === id,
    ) ?? { id, name: "Counter" };
    if (!sameDocument) {
      const match = existing.find(
        (definition) =>
          normalizeAssetName(definition.name) ===
          normalizeAssetName(copied.name),
      );
      if (match) {
        map.set(id, match.id);
        continue;
      }
    }
    let freshId = sameDocument ? id : generateCounterId();
    while (!sameDocument && existingIds.has(freshId))
      freshId = generateCounterId();
    const definition = { id: freshId, name: uniqueName(copied.name, taken) };
    additions.push(definition);
    existingIds.add(freshId);
    taken.add(normalizeAssetName(definition.name));
    map.set(id, freshId);
  }

  const remapped =
    map.size > 0 ? remapPastedRoots(document, rootIds, map) : document;
  if (additions.length === 0) return remapped;
  return {
    ...remapped,
    styleAssets: {
      ...remapped.styleAssets,
      counters: [...existing, ...additions],
    },
  };
}
