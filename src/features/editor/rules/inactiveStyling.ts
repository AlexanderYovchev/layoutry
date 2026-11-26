import {
  COUNTER_STATE_LIMITATION,
  DEFAULT_STATE_ONLY_TYPOGRAPHY_FIELDS,
  DIRECTION_STATE_LIMITATION,
  evaluateContextCapability,
  type StylingApplicability,
} from "@/features/editor/rules/stylingContextPredicates";
import {
  ANCESTOR_ATOMS,
  getStylingCapabilities,
  isCuratedCompound,
  profileAtoms,
  resolveStylingProfile,
  targetsAcrossVariants,
  type TargetCapability,
} from "@/features/editor/rules/stylingRegistry";
import type { EditorElementNode } from "@/features/editor/types/document";
import {
  isDefaultCondition,
  STYLE_RULE_GROUP_KEYS,
  type AncestorScope,
  type StyleRule,
  type StyleRuleGroupKey,
  type StyleRuleGroups,
} from "@/features/editor/types/styleRules";

/**
 * BC-17.2 — inactive styling (BC-17.1.3 Report 1 §4.8, §5.6).
 *
 * A rule (or one of its groups or fields) is INACTIVE when it is valid,
 * stored data the registry does not apply in the node's CURRENT state: a
 * Progress part of the other variant, a state the profile doesn't have, an
 * uncurated compound, an ancestor scope that no longer resolves, a group a
 * pseudo-element can't take, or a context limitation (a Free child's
 * logical size). Inactivity is COMPUTED, never stored, so it can't go
 * stale, and computing it never changes the document: inactive data stays
 * stored, validated and restorable. Invalid data is a different thing —
 * the schema and integrity checks reject it before it ever gets here.
 */

export type InactiveReason =
  | "unknown-profile"
  | "target-other-variant"
  | "target-not-applicable"
  | "target-context"
  | "state-not-applicable"
  | "compound-not-curated"
  | "ancestor-unresolved"
  | "ancestor-state-not-applicable"
  | "group-not-applicable"
  | "field-not-applicable"
  | "context-inapplicable"
  | "context-limitation";

export interface InactiveRule {
  ruleId: string;
  reason: InactiveReason;
  message: string;
}

export type StylingSource = { kind: "base" } | { kind: "rule"; ruleId: string };

export interface InactiveField {
  source: StylingSource;
  group: StyleRuleGroupKey;
  /** Absent when the whole group is inactive. */
  field?: string;
  reason: InactiveReason;
  message: string;
}

export interface InactiveStyling {
  rules: InactiveRule[];
  fields: InactiveField[];
}

/**
 * The inactive rules and fields of `node`. `ancestors` is the path from
 * the document root to the node's parent (root first), as the tree
 * walkers already produce it.
 */
export function computeInactiveStyling(
  node: EditorElementNode,
  ancestors: readonly EditorElementNode[],
): InactiveStyling {
  const parent = ancestors.at(-1);
  const result: InactiveStyling = { rules: [], fields: [] };
  const capabilities = getStylingCapabilities(node);

  // Base styling: only the fields a context predicate governs (the BC-17.2
  // foundation fields). Base groups' general applicability stays what the
  // existing Inspector already decides from elementCapabilities.
  result.fields.push(
    ...contextFieldInactivity(
      { kind: "base" },
      nodeBaseGroups(node),
      node,
      parent,
    ),
  );

  for (const rule of node.styleRules ?? []) {
    const inactive = ruleInactivity(
      rule,
      node,
      ancestors,
      capabilities?.targets.get(rule.target),
      capabilities === undefined,
    );
    if (inactive) {
      result.rules.push({ ruleId: rule.id, ...inactive });
      continue;
    }
    const target = capabilities?.targets.get(rule.target);
    if (!target) continue;
    result.fields.push(...groupFieldInactivity(rule, target));
    result.fields.push(
      ...contextFieldInactivity(
        { kind: "rule", ruleId: rule.id },
        rule.groups,
        node,
        parent,
      ),
    );
    if (!isDefaultCondition(rule.condition))
      result.fields.push(...defaultStateOnlyInactivity(rule));
  }
  return result;
}

function nodeBaseGroups(node: EditorElementNode): StyleRuleGroups {
  return { position: node.position, logicalSize: node.logicalSize };
}

function ruleInactivity(
  rule: StyleRule,
  node: EditorElementNode,
  ancestors: readonly EditorElementNode[],
  target: TargetCapability | undefined,
  unknownProfile: boolean,
): { reason: InactiveReason; message: string } | null {
  if (unknownProfile)
    return {
      reason: "unknown-profile",
      message: `"${node.tag}" elements have no styling profile.`,
    };
  if (!target) {
    return targetsAcrossVariants(node).has(rule.target)
      ? {
          reason: "target-other-variant",
          message: `"${rule.target}" belongs to the other variant of this element; it is kept and applies again after switching back.`,
        }
      : {
          reason: "target-not-applicable",
          message: `This element has no "${rule.target}" target.`,
        };
  }
  if (rule.target === "first-line" || rule.target === "first-letter") {
    const context = evaluateContextCapability(
      rule.target === "first-line" ? "firstLine" : "firstLetter",
      node,
      ancestors.at(-1),
    );
    if (context.status !== "applicable")
      return { reason: "target-context", message: context.reason };
  }
  const self = rule.condition.self ?? [];
  for (const atom of self) {
    if (!target.atoms.includes(atom))
      return {
        reason: "state-not-applicable",
        message: `"${rule.target}" of this element has no "${atom}" state.`,
      };
  }
  const ancestor = rule.condition.ancestor;
  if (self.length >= 2 || (self.length >= 1 && ancestor)) {
    if (ancestor || !isCuratedCompound(target, self))
      return {
        reason: "compound-not-curated",
        message: "This combination of states is not offered for this element.",
      };
  }
  if (ancestor) {
    if (!ANCESTOR_ATOMS.includes(ancestor.atom))
      return {
        reason: "ancestor-state-not-applicable",
        message: `"${ancestor.atom}" can't be used as an ancestor state.`,
      };
    const resolved = resolveAncestorScope(ancestor.scope, ancestors);
    if (!resolved)
      return {
        reason: "ancestor-unresolved",
        message:
          "The ancestor this rule depends on no longer exists around this element.",
      };
    const resolvedProfile = resolveStylingProfile(resolved);
    if (
      !resolvedProfile ||
      !profileAtoms(resolvedProfile).includes(ancestor.atom)
    )
      return {
        reason: "ancestor-state-not-applicable",
        message: `The ancestor can't be in the "${ancestor.atom}" state.`,
      };
  }
  return null;
}

/** Interactive or grouping roots a "component" scope resolves to (refined with composition identity in BC-17.5). */
const COMPONENT_ROOT_TAGS: ReadonlySet<string> = new Set([
  "form",
  "label",
  "fieldset",
  "dialog",
  "button",
  "a",
]);

/** The ancestor a scope resolves to against the current tree, or undefined. */
export function resolveAncestorScope(
  scope: AncestorScope,
  ancestors: readonly EditorElementNode[],
): EditorElementNode | undefined {
  const candidates = ancestors.filter((ancestor) => ancestor.tag !== "page");
  switch (scope.kind) {
    case "parent":
      return candidates.at(-1);
    case "component":
      return candidates.findLast(
        (ancestor) =>
          ancestor.component !== undefined ||
          COMPONENT_ROOT_TAGS.has(ancestor.tag),
      );
    case "profile":
      return candidates.findLast(
        (ancestor) => resolveStylingProfile(ancestor) === scope.profile,
      );
  }
}

function authoredGroups(groups: StyleRuleGroups): StyleRuleGroupKey[] {
  return STYLE_RULE_GROUP_KEYS.filter((key) => groups[key] !== undefined);
}

function authoredFields(
  groups: StyleRuleGroups,
  group: StyleRuleGroupKey,
): string[] {
  const value: unknown = groups[group];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.keys(value)
    : [];
}

function groupFieldInactivity(
  rule: StyleRule,
  target: TargetCapability,
): InactiveField[] {
  const source: StylingSource = { kind: "rule", ruleId: rule.id };
  const fields: InactiveField[] = [];
  for (const group of authoredGroups(rule.groups)) {
    if (!target.groups.has(group)) {
      fields.push({
        source,
        group,
        reason: "group-not-applicable",
        message: `"${rule.target}" can't take ${group} styling.`,
      });
      continue;
    }
    const allowed = target.fields?.[group];
    if (!allowed) continue;
    for (const field of authoredFields(rule.groups, group)) {
      if (!allowed.includes(field))
        fields.push({
          source,
          group,
          field,
          reason: "field-not-applicable",
          message: `"${rule.target}" can't take ${group}.${field}.`,
        });
    }
  }
  return fields;
}

function fromApplicability(
  source: StylingSource,
  group: StyleRuleGroupKey,
  field: string | undefined,
  applicability: StylingApplicability,
): InactiveField[] {
  if (applicability.status === "applicable") return [];
  return [
    {
      source,
      group,
      ...(field ? { field } : {}),
      reason:
        applicability.status === "inapplicable"
          ? "context-inapplicable"
          : "context-limitation",
      message: applicability.reason,
    },
  ];
}

/** Predicate-governed fields: logical insets and logical sizes (P-2). */
function contextFieldInactivity(
  source: StylingSource,
  groups: StyleRuleGroups,
  node: EditorElementNode,
  parent: EditorElementNode | undefined,
): InactiveField[] {
  const fields: InactiveField[] = [];
  if (groups.position?.insetLogical !== undefined)
    fields.push(
      ...fromApplicability(
        source,
        "position",
        "insetLogical",
        evaluateContextCapability("logicalInsets", node, parent),
      ),
    );
  if (groups.logicalSize !== undefined)
    fields.push(
      ...fromApplicability(
        source,
        "logicalSize",
        undefined,
        evaluateContextCapability("logicalSize", node, parent),
      ),
    );
  return fields;
}

/** Direction / writing mode and counter operations are Default-state only (editor limitations). */
function defaultStateOnlyInactivity(rule: StyleRule): InactiveField[] {
  const source: StylingSource = { kind: "rule", ruleId: rule.id };
  const fields: InactiveField[] = [];
  for (const field of authoredFields(rule.groups, "typography")) {
    if (DEFAULT_STATE_ONLY_TYPOGRAPHY_FIELDS.includes(field))
      fields.push({
        source,
        group: "typography",
        field,
        reason: "context-limitation",
        message: DIRECTION_STATE_LIMITATION,
      });
  }
  if (rule.groups.counters !== undefined)
    fields.push({
      source,
      group: "counters",
      reason: "context-limitation",
      message: COUNTER_STATE_LIMITATION,
    });
  return fields;
}
