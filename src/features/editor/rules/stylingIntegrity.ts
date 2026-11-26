import {
  counterOperationRefs,
  type CounterDefinition,
  type CounterRef,
} from "@/features/editor/types/counters";
import type { EditorElementNode } from "@/features/editor/types/document";
import {
  normalizeAssetName,
  type KeyframesDefinition,
  type PresetPayload,
  type StyleAssets,
} from "@/features/editor/types/styleAssets";
import {
  canonicalConditionKey,
  type StyleRule,
  type StyleRuleGroups,
} from "@/features/editor/types/styleRules";

/**
 * BC-17.2 — document-wide integrity of the styling foundation (BC-17.1.3
 * Report 1 §4.2, §4.9, §4.11). The strict schema has already checked each
 * value's local shape; these are the cross-field and cross-node rules:
 *
 * - styleAssets only on the document root;
 * - asset ids unique per list, display names unique per list after
 *   normalizeAssetName;
 * - style rule ids unique across the whole document;
 * - at most one rule per (target, canonical condition) on a node;
 * - every document counter reference resolves to a definition (no
 *   dangling references), in nodes, rules, content and keyframes;
 * - Progress-only fields only on <progress>.
 *
 * Expects a proper tree (checkDocumentIntegrity runs its tree checks
 * first). Iterative; returns the first problem in document order.
 */
export interface StylingIntegrityError {
  message: string;
  path: string;
}

const PROGRESS_ONLY_FIELDS = [
  "progressVariant",
  "progressSegments",
  "progressLabel",
] as const;

export function findStylingIntegrityError(
  root: EditorElementNode,
): StylingIntegrityError | null {
  const assets = root.styleAssets;
  const assetError = assets
    ? findAssetsError(assets, "document.styleAssets")
    : null;
  if (assetError) return assetError;
  const counterIds = new Set(
    (assets?.counters ?? []).map((definition) => definition.id),
  );
  const keyframeError = (
    assets?.keyframes ?? []
  ).reduce<StylingIntegrityError | null>(
    (error, definition, index) =>
      error ??
      findKeyframeReferenceError(
        definition,
        counterIds,
        `document.styleAssets.keyframes[${index}]`,
      ),
    null,
  );
  if (keyframeError) return keyframeError;

  const ruleIds = new Set<string>();
  const stack: { node: EditorElementNode; path: string; isRoot: boolean }[] = [
    { node: root, path: "document", isRoot: true },
  ];
  while (stack.length > 0) {
    const { node, path, isRoot } = stack.pop()!;
    if (!isRoot && node.styleAssets !== undefined)
      return {
        message: "Styling assets may only be stored on the document root.",
        path: `${path}.styleAssets`,
      };
    if (node.tag !== "progress") {
      const misplaced = PROGRESS_ONLY_FIELDS.find(
        (field) => node[field] !== undefined,
      );
      if (misplaced)
        return {
          message: `"${misplaced}" is only allowed on a Progress Bar.`,
          path: `${path}.${misplaced}`,
        };
    }
    const nodeError =
      findCounterRefError(
        counterOperationRefs(node.counters),
        counterIds,
        `${path}.counters`,
      ) ??
      findRulesError(
        node.styleRules ?? [],
        counterIds,
        ruleIds,
        `${path}.styleRules`,
      );
    if (nodeError) return nodeError;
    const children = node.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1)
      stack.push({
        node: children[index],
        path: `${path}.children[${index}]`,
        isRoot: false,
      });
  }
  return null;
}

function findDuplicate<T>(
  items: readonly T[],
  key: (item: T) => string,
): number {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    const value = key(item);
    if (seen.has(value)) return index;
    seen.add(value);
  }
  return -1;
}

function findNamedListError(
  items: readonly { id: string; name: string }[],
  label: string,
  path: string,
): StylingIntegrityError | null {
  const duplicateId = findDuplicate(items, (item) => item.id);
  if (duplicateId >= 0)
    return {
      message: `Id "${items[duplicateId].id}" is used by more than one ${label}.`,
      path: `${path}[${duplicateId}].id`,
    };
  const duplicateName = findDuplicate(items, (item) =>
    normalizeAssetName(item.name),
  );
  if (duplicateName >= 0)
    return {
      message: `The ${label} name "${items[duplicateName].name}" is used more than once.`,
      path: `${path}[${duplicateName}].name`,
    };
  return null;
}

function findAssetsError(
  assets: StyleAssets,
  path: string,
): StylingIntegrityError | null {
  const presets = assets.presets ?? [];
  return (
    findNamedListError(
      assets.keyframes ?? [],
      "keyframes definition",
      `${path}.keyframes`,
    ) ??
    findNamedListError(assets.counters ?? [], "counter", `${path}.counters`) ??
    findNamedListError(presets, "preset", `${path}.presets`) ??
    presets.reduce<StylingIntegrityError | null>(
      (error, preset, index) =>
        error ??
        findPresetPayloadError(
          preset.payload,
          `${path}.presets[${index}].payload`,
        ),
      null,
    )
  );
}

/** A preset is self-contained: its references resolve inside its own payload (it is applied detached, BC-17.23). */
function findPresetPayloadError(
  payload: PresetPayload,
  path: string,
): StylingIntegrityError | null {
  const counters: CounterDefinition[] = payload.counters ?? [];
  const counterIds = new Set(counters.map((definition) => definition.id));
  return (
    findNamedListError(counters, "counter", `${path}.counters`) ??
    findNamedListError(
      payload.keyframes ?? [],
      "keyframes definition",
      `${path}.keyframes`,
    ) ??
    findCounterRefError(
      groupCounterRefs(payload.groups),
      counterIds,
      `${path}.groups.counters`,
    ) ??
    findRulesError(
      payload.rules ?? [],
      counterIds,
      new Set(),
      `${path}.rules`,
    ) ??
    (payload.keyframes ?? []).reduce<StylingIntegrityError | null>(
      (error, definition, index) =>
        error ??
        findKeyframeReferenceError(
          definition,
          counterIds,
          `${path}.keyframes[${index}]`,
        ),
      null,
    )
  );
}

function findKeyframeReferenceError(
  definition: KeyframesDefinition,
  counterIds: ReadonlySet<string>,
  path: string,
): StylingIntegrityError | null {
  for (const [index, stop] of definition.stops.entries()) {
    const error = findCounterRefError(
      groupCounterRefs(stop.groups),
      counterIds,
      `${path}.stops[${index}].groups.counters`,
    );
    if (error) return error;
  }
  return null;
}

function groupCounterRefs(groups: StyleRuleGroups | undefined): CounterRef[] {
  return counterOperationRefs(groups?.counters);
}

function contentCounterRefs(rule: StyleRule): CounterRef[] {
  if (rule.content?.kind !== "parts") return [];
  return rule.content.parts.flatMap((part) =>
    part.kind === "counter" || part.kind === "counters" ? [part.counter] : [],
  );
}

function findCounterRefError(
  refs: readonly CounterRef[],
  counterIds: ReadonlySet<string>,
  path: string,
): StylingIntegrityError | null {
  const missing = refs.find(
    (ref) => ref.kind === "document" && !counterIds.has(ref.id),
  );
  return missing && missing.kind === "document"
    ? {
        message: `A counter reference points at counter "${missing.id}", which does not exist.`,
        path,
      }
    : null;
}

function findRulesError(
  rules: readonly StyleRule[],
  counterIds: ReadonlySet<string>,
  ruleIds: Set<string>,
  path: string,
): StylingIntegrityError | null {
  const pairs = new Set<string>();
  for (const [index, rule] of rules.entries()) {
    const rulePath = `${path}[${index}]`;
    if (ruleIds.has(rule.id))
      return {
        message: `Style rule id "${rule.id}" is used more than once.`,
        path: `${rulePath}.id`,
      };
    ruleIds.add(rule.id);
    const pair = `${rule.target}|${canonicalConditionKey(rule.condition)}`;
    if (pairs.has(pair))
      return {
        message: `There is more than one "${rule.target}" rule for the same state.`,
        path: `${rulePath}.condition`,
      };
    pairs.add(pair);
    const error =
      findCounterRefError(
        groupCounterRefs(rule.groups),
        counterIds,
        `${rulePath}.groups.counters`,
      ) ??
      findCounterRefError(
        contentCounterRefs(rule),
        counterIds,
        `${rulePath}.content`,
      );
    if (error) return error;
  }
  return null;
}
