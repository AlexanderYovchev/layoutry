import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderSettings } from "@/features/editor/types/border";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BoxShadowSettings } from "@/features/editor/types/boxShadow";
import type {
  CounterOperations,
  CounterRef,
  CounterStyleRef,
} from "@/features/editor/types/counters";
import type { DisplaySettings } from "@/features/editor/types/display";
import type { FilterSettings } from "@/features/editor/types/filters";
import type { LogicalSizeSettings } from "@/features/editor/types/logicalProperties";
import type { MediaFitSettings } from "@/features/editor/types/mediaFit";
import type { OutlineSettings } from "@/features/editor/types/outline";
import type { PositionSettings } from "@/features/editor/types/position";
import type { ShapePreset } from "@/features/editor/types/shape";
import type { SizeConstraints } from "@/features/editor/types/sizeConstraints";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import type { TransformSettings } from "@/features/editor/types/transform";
import type { TransitionSettings } from "@/features/editor/types/transition";
import type { TypographySettings } from "@/features/editor/types/typography";

/**
 * BC-17.2 — the shared styling-rule model (BC-17.1.3 Report 1 §4–§5).
 *
 * A node's existing top-level groups (typography, background, …) stay its
 * BASE styling: the implicit rule for target "element" in the default
 * state. They are never copied into styleRules. A StyleRule adds styling
 * for one (target, condition) pair: a part, a pseudo-element, a state, a
 * curated compound state or a scoped ancestor state. Rules hold the SAME
 * typed groups as the base, never selector strings or raw CSS.
 *
 * Nothing renders rules yet (the compiler is BC-17.3); this checkpoint
 * only defines, validates and persists them.
 */

// --- State atoms (closed; the array order is the canonical order) ---------

export const STATE_ATOMS = [
  "hover",
  "focus",
  "focus-visible",
  "focus-within",
  "active",
  "checked",
  "indeterminate",
  "invalid",
  "required",
  "read-only",
  "placeholder-shown",
  "disabled",
  "current",
  "expanded",
  "open",
  "selected",
] as const;
export type StateAtom = (typeof STATE_ATOMS)[number];

const ATOM_ORDER = new Map<string, number>(
  STATE_ATOMS.map((atom, index) => [atom, index]),
);

/** Position of an atom in the canonical order (unknown strings sort last). */
export function stateAtomRank(atom: string): number {
  return ATOM_ORDER.get(atom) ?? STATE_ATOMS.length;
}

// --- Targets (global semantic ids, each with one kind) --------------------

export type StyleTargetKind =
  "element" | "pseudo" | "part" | "structural" | "role-group";

export const STYLE_TARGET_IDS = [
  "element",
  "before",
  "after",
  "placeholder",
  "marker",
  "selection",
  "backdrop",
  "first-line",
  "first-letter",
  "progress.track",
  "progress.fill",
  "progress.segment",
  "progress.label",
  "toggle.box",
  "toggle.indicator",
  "select.arrow",
  "search.cancel",
  "number.spin",
  "scrollbar",
  "scrollbar.thumb",
  "scrollbar.track",
  "table.headerRow",
  "table.bodyRow",
  "table.altRow",
  "table.cell",
  "table.headerCell",
  "table.caption",
  "list.first",
  "list.last",
  "group.first",
  "group.last",
  "pagination.page",
  "pagination.current",
  "pagination.prevNext",
  "pagination.disabled",
  "pagination.ellipsis",
  "tabs.tab",
  "tabs.panel",
  "tabs.list",
  "nav.link",
  "nav.current",
  "nav.cta",
  "breadcrumb.separator",
] as const;
export type StyleTargetId = (typeof STYLE_TARGET_IDS)[number];

/** Each target's kind (a Record over every id, so none can be missing or extra). */
export const STYLE_TARGETS: Readonly<Record<StyleTargetId, StyleTargetKind>> = {
  element: "element",
  before: "pseudo",
  after: "pseudo",
  placeholder: "pseudo",
  marker: "pseudo",
  selection: "pseudo",
  backdrop: "pseudo",
  "first-line": "pseudo",
  "first-letter": "pseudo",
  "progress.track": "part",
  "progress.fill": "part",
  "progress.segment": "part",
  "progress.label": "part",
  "toggle.box": "part",
  "toggle.indicator": "part",
  "select.arrow": "part",
  "search.cancel": "part",
  "number.spin": "part",
  scrollbar: "part",
  "scrollbar.thumb": "part",
  "scrollbar.track": "part",
  "table.headerRow": "structural",
  "table.bodyRow": "structural",
  "table.altRow": "structural",
  "table.cell": "structural",
  "table.headerCell": "structural",
  "table.caption": "structural",
  "list.first": "structural",
  "list.last": "structural",
  "group.first": "structural",
  "group.last": "structural",
  "pagination.page": "role-group",
  "pagination.current": "role-group",
  "pagination.prevNext": "role-group",
  "pagination.disabled": "role-group",
  "pagination.ellipsis": "role-group",
  "tabs.tab": "role-group",
  "tabs.panel": "role-group",
  "tabs.list": "role-group",
  "nav.link": "role-group",
  "nav.current": "role-group",
  "nav.cta": "role-group",
  "breadcrumb.separator": "role-group",
};

const TARGET_ID_SET: ReadonlySet<string> = new Set(STYLE_TARGET_IDS);

export function isStyleTargetId(value: string): value is StyleTargetId {
  return TARGET_ID_SET.has(value);
}

export function styleTargetKind(target: StyleTargetId): StyleTargetKind {
  return STYLE_TARGETS[target];
}

/** The pseudo targets that can carry generated content (Report 1 §4.4, §10). */
export const CONTENT_TARGETS: ReadonlySet<StyleTargetId> = new Set([
  "before",
  "after",
  "marker",
]);

// --- Profiles (Report 1 §5.1; resolved by stylingRegistry) ----------------

export const STYLING_PROFILES = [
  "page",
  "body",
  "container",
  "text",
  "button",
  "link",
  "list",
  "list-item",
  "field",
  "textarea",
  "select",
  "option",
  "toggle-checkbox",
  "toggle-radio",
  "progress-native",
  "progress-custom",
  "media-image",
  "media-video",
  "media-audio",
  "embed",
  "svg",
  "table",
  "table-section",
  "table-row",
  "table-cell",
  "table-caption",
  "dialog",
  "divider",
] as const;
export type StylingProfileId = (typeof STYLING_PROFILES)[number];

// --- Conditions -----------------------------------------------------------

export type AncestorScope =
  | { kind: "parent" }
  | { kind: "component" }
  | { kind: "profile"; profile: StylingProfileId };

/**
 * The state a rule applies in. `{}` is the default state. `self` lists the
 * node's own atoms in canonical order with no duplicates (two or more =
 * a compound, allowed only where the registry curates it, N6). `ancestor`
 * is one atom of one resolved ancestor (O6).
 */
export interface StyleCondition {
  self?: StateAtom[];
  ancestor?: { scope: AncestorScope; atom: StateAtom };
}

/** A stable text key for a condition: equal for canonically equal conditions. */
export function canonicalConditionKey(condition: StyleCondition): string {
  const self = [...(condition.self ?? [])]
    .sort((a, b) => stateAtomRank(a) - stateAtomRank(b))
    .join("+");
  const ancestor = condition.ancestor;
  const scope = !ancestor
    ? ""
    : ancestor.scope.kind === "profile"
      ? `profile:${ancestor.scope.profile}`
      : ancestor.scope.kind;
  return `self=${self};ancestor=${ancestor ? `${scope}:${ancestor.atom}` : ""}`;
}

export function isDefaultCondition(condition: StyleCondition): boolean {
  return (
    (condition.self === undefined || condition.self.length === 0) &&
    condition.ancestor === undefined
  );
}

// --- Generated content (O7, P-4) -----------------------------------------

/** Allow-listed glyphs, each one code point (the printer maps id → character). */
export const GLYPH_IDS = [
  "arrow-right",
  "arrow-left",
  "arrow-up",
  "arrow-down",
  "chevron-right",
  "chevron-left",
  "triangle-right",
  "triangle-down",
  "check",
  "cross",
  "plus",
  "minus",
  "bullet",
  "middle-dot",
  "star",
  "heart",
  "quote-open",
  "quote-close",
  "ellipsis",
  "slash",
  "pipe",
  "section",
] as const;
export type GlyphId = (typeof GLYPH_IDS)[number];

export const CONTENT_GLYPHS: Readonly<Record<GlyphId, string>> = {
  "arrow-right": "→",
  "arrow-left": "←",
  "arrow-up": "↑",
  "arrow-down": "↓",
  "chevron-right": "›",
  "chevron-left": "‹",
  "triangle-right": "▸",
  "triangle-down": "▾",
  check: "✓",
  cross: "✕",
  plus: "+",
  minus: "−",
  bullet: "•",
  "middle-dot": "·",
  star: "★",
  heart: "♥",
  "quote-open": "“",
  "quote-close": "”",
  ellipsis: "…",
  slash: "/",
  pipe: "|",
  section: "§",
};

export type ContentPart =
  | { kind: "text"; text: string }
  | { kind: "glyph"; glyph: GlyphId }
  | { kind: "counter"; counter: CounterRef; style: CounterStyleRef }
  | {
      kind: "counters";
      counter: CounterRef;
      separator: string;
      style: CounterStyleRef;
    };

export type PseudoContent =
  { kind: "empty" } | { kind: "parts"; parts: ContentPart[]; altText?: string };

export const MAX_CONTENT_PARTS = 16;
/** Text parts, separators and altText together (Report 1 §4.4). */
export const MAX_CONTENT_TEXT_LENGTH = 200;

// --- Rules ---------------------------------------------------------------

/** The typed groups a rule may hold: the same shapes as a node's base groups. */
export interface StyleRuleGroups {
  typography?: TypographySettings;
  background?: BackgroundSettings;
  border?: BorderSettings;
  borderRadius?: BorderRadiusSettings;
  shape?: ShapePreset;
  boxShadow?: BoxShadowSettings;
  filters?: FilterSettings;
  display?: DisplaySettings;
  position?: PositionSettings;
  spacing?: ElementSpacing;
  sizeConstraints?: SizeConstraints;
  logicalSize?: LogicalSizeSettings;
  mediaFit?: MediaFitSettings;
  transition?: TransitionSettings;
  transform?: TransformSettings;
  outline?: OutlineSettings;
  counters?: CounterOperations;
}
export type StyleRuleGroupKey = keyof StyleRuleGroups;

export const STYLE_RULE_GROUP_KEYS = [
  "typography",
  "background",
  "border",
  "borderRadius",
  "shape",
  "boxShadow",
  "filters",
  "display",
  "position",
  "spacing",
  "sizeConstraints",
  "logicalSize",
  "mediaFit",
  "transition",
  "transform",
  "outline",
  "counters",
] as const satisfies readonly StyleRuleGroupKey[];

export interface StyleRule {
  /** Document-unique; regenerated when the node is cloned or pasted. */
  id: string;
  target: StyleTargetId;
  condition: StyleCondition;
  groups: StyleRuleGroups;
  /** Only on before / after / marker targets. */
  content?: PseudoContent;
}

/** Security bound for untrusted files (Report 1 §17), not a UX cap. */
export const MAX_STYLE_RULES_PER_NODE = 256;

export function generateStyleRuleId(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `rule-${suffix}`;
}
