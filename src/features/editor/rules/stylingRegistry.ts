import { getElementCapabilities } from "@/features/editor/rules/elementCapabilities";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getProgressVariant } from "@/features/editor/types/progress";
import {
  stateAtomRank,
  type StateAtom,
  type StyleRuleGroupKey,
  type StyleTargetId,
  type StylingProfileId,
} from "@/features/editor/types/styleRules";

/**
 * BC-17.2 — the styling capability registry (BC-17.1.3 Report 1 §5,
 * Report 2). It answers, for a node: which styling profile it has, which
 * targets it offers, which state atoms and curated compounds each target
 * takes, and which groups (and, for some pseudo-elements, which fields)
 * apply. It describes CSS APPLICABILITY. Whether the editor can already
 * AUTHOR something is a separate question (stylingAuthoring below): in
 * BC-17.2 nothing new is authorable, so the registry exposes no UI.
 *
 * Single source of truth: element-target groups are DERIVED from
 * elementCapabilities (the same booleans the Inspector already uses), plus
 * the few groups the capability set has no flag for (spacing, outline,
 * counters, size). Nothing here duplicates a capability flag.
 */

// --- Profiles --------------------------------------------------------------

const TAG_PROFILES: Readonly<Record<string, StylingProfileId>> = {
  page: "page",
  body: "body",
  div: "container",
  section: "container",
  header: "container",
  footer: "container",
  main: "container",
  article: "container",
  aside: "container",
  nav: "container",
  figure: "container",
  form: "container",
  label: "container",
  fieldset: "container",
  h1: "text",
  h2: "text",
  h3: "text",
  h4: "text",
  h5: "text",
  h6: "text",
  p: "text",
  blockquote: "text",
  figcaption: "text",
  legend: "text",
  button: "button",
  a: "link",
  hr: "divider",
  ul: "list",
  ol: "list",
  li: "list-item",
  input: "field",
  textarea: "textarea",
  select: "select",
  option: "option",
  progress: "progress-native",
  table: "table",
  caption: "table-caption",
  thead: "table-section",
  tbody: "table-section",
  tfoot: "table-section",
  tr: "table-row",
  th: "table-cell",
  td: "table-cell",
  img: "media-image",
  video: "media-video",
  audio: "media-audio",
  iframe: "embed",
  svg: "svg",
  dialog: "dialog",
};

/** Every tag with a profile (registryCoverage tests compare it with KNOWN_ELEMENT_TAGS). */
export const PROFILED_TAGS: readonly string[] = Object.keys(TAG_PROFILES);

/** The node's styling profile, from its tag, input type and Progress variant; undefined for an unknown tag. */
export function resolveStylingProfile(
  node: Pick<EditorElementNode, "tag" | "inputType" | "progressVariant">,
): StylingProfileId | undefined {
  const profile = TAG_PROFILES[node.tag];
  if (profile === "field" && node.inputType === "checkbox")
    return "toggle-checkbox";
  if (profile === "field" && node.inputType === "radio") return "toggle-radio";
  if (profile === "progress-native" && getProgressVariant(node) === "custom")
    return "progress-custom";
  return profile;
}

// --- Groups ----------------------------------------------------------------

/** The groups a box-generating pseudo-element or structural/role target can take. */
const BOX_GROUPS: readonly StyleRuleGroupKey[] = [
  "typography",
  "background",
  "border",
  "borderRadius",
  "boxShadow",
  "filters",
  "display",
  "position",
  "spacing",
  "sizeConstraints",
  "logicalSize",
  "transform",
  "transition",
  "outline",
  "counters",
];

/**
 * Element-target groups the capability flags don't cover yet but the
 * corrected matrix makes applicable (Report 2 A5: inherited container
 * typography, BC-17.7). Listed explicitly so the extension is visible.
 */
const PROFILE_GROUP_EXTENSIONS: Partial<
  Record<StylingProfileId, readonly StyleRuleGroupKey[]>
> = {
  container: ["typography"],
  list: ["typography"],
  dialog: ["typography"],
};

function elementGroups(
  node: Pick<EditorElementNode, "tag">,
  profile: StylingProfileId,
): ReadonlySet<StyleRuleGroupKey> {
  const capabilities = getElementCapabilities(node.tag);
  const groups = new Set<StyleRuleGroupKey>();
  const flags: [boolean, StyleRuleGroupKey][] = [
    [capabilities.supportsTypography, "typography"],
    [capabilities.supportsBackground, "background"],
    [capabilities.supportsBorder, "border"],
    [capabilities.supportsBorder, "outline"],
    [capabilities.supportsBorderRadius, "borderRadius"],
    [capabilities.supportsBoxShadow, "boxShadow"],
    [capabilities.supportsShape, "shape"],
    [capabilities.supportsFilters, "filters"],
    [capabilities.supportsDisplay, "display"],
    [capabilities.supportsPosition, "position"],
    [capabilities.supportsTransition, "transition"],
    [capabilities.supportsTransform, "transform"],
    [capabilities.supportsMediaFit, "mediaFit"],
    [capabilities.resizableX || capabilities.resizableY, "sizeConstraints"],
    [capabilities.resizableX || capabilities.resizableY, "logicalSize"],
  ];
  for (const [supported, group] of flags) if (supported) groups.add(group);
  if (profile !== "option") {
    groups.add("spacing");
    groups.add("counters");
  }
  for (const group of PROFILE_GROUP_EXTENSIONS[profile] ?? [])
    groups.add(group);
  return groups;
}

type FieldAllowList = Partial<Record<StyleRuleGroupKey, readonly string[]>>;

interface TargetGroups {
  groups: readonly StyleRuleGroupKey[];
  /** Only these fields of a listed group apply (CSS Pseudo-Elements allow-lists, Report 1 §10.3). */
  fields?: FieldAllowList;
}

const FONT_FIELDS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
] as const;

const NON_ELEMENT_TARGET_GROUPS: Readonly<
  Record<Exclude<StyleTargetId, "element">, TargetGroups>
> = {
  before: { groups: BOX_GROUPS },
  after: { groups: BOX_GROUPS },
  placeholder: {
    groups: ["typography", "filters"],
    fields: {
      typography: [
        ...FONT_FIELDS,
        "color",
        "letterSpacing",
        "textDecorationLine",
      ],
      filters: ["opacity"],
    },
  },
  marker: {
    groups: ["typography", "counters"],
    fields: { typography: [...FONT_FIELDS, "color"] },
  },
  selection: {
    groups: ["typography", "background"],
    fields: {
      typography: ["color", "textDecorationLine"],
      background: ["color"],
    },
  },
  backdrop: { groups: ["background", "filters"] },
  "first-line": {
    groups: ["typography", "background"],
    fields: {
      typography: [
        ...FONT_FIELDS,
        "color",
        "letterSpacing",
        "lineHeight",
        "textDecorationLine",
      ],
    },
  },
  "first-letter": {
    groups: [
      "typography",
      "background",
      "border",
      "borderRadius",
      "boxShadow",
      "spacing",
    ],
  },
  "progress.track": {
    groups: ["background", "border", "borderRadius", "boxShadow", "filters"],
  },
  "progress.fill": {
    groups: ["background", "border", "borderRadius", "boxShadow", "filters"],
  },
  "progress.segment": {
    groups: ["background", "border", "borderRadius", "boxShadow"],
  },
  "progress.label": {
    groups: ["typography", "background", "border", "borderRadius", "spacing"],
  },
  "toggle.box": {
    groups: [
      "background",
      "border",
      "borderRadius",
      "boxShadow",
      "transform",
      "transition",
    ],
  },
  "toggle.indicator": {
    groups: [
      "background",
      "border",
      "borderRadius",
      "boxShadow",
      "transform",
      "transition",
    ],
  },
  "select.arrow": { groups: ["background"] },
  "search.cancel": { groups: ["display", "background"] },
  "number.spin": { groups: ["display", "background"] },
  scrollbar: { groups: ["background", "border", "borderRadius"] },
  "scrollbar.thumb": { groups: ["background", "border", "borderRadius"] },
  "scrollbar.track": { groups: ["background", "border", "borderRadius"] },
  "table.headerRow": {
    groups: ["typography", "background", "border", "spacing"],
  },
  "table.bodyRow": {
    groups: ["typography", "background", "border", "spacing"],
  },
  "table.altRow": { groups: ["typography", "background", "border", "spacing"] },
  "table.cell": { groups: ["typography", "background", "border", "spacing"] },
  "table.headerCell": {
    groups: ["typography", "background", "border", "spacing"],
  },
  "table.caption": {
    groups: ["typography", "background", "border", "spacing"],
  },
  "list.first": { groups: BOX_GROUPS },
  "list.last": { groups: BOX_GROUPS },
  "group.first": { groups: BOX_GROUPS },
  "group.last": { groups: BOX_GROUPS },
  "pagination.page": { groups: BOX_GROUPS },
  "pagination.current": { groups: BOX_GROUPS },
  "pagination.prevNext": { groups: BOX_GROUPS },
  "pagination.disabled": { groups: BOX_GROUPS },
  "pagination.ellipsis": { groups: BOX_GROUPS },
  "tabs.tab": { groups: BOX_GROUPS },
  "tabs.panel": { groups: BOX_GROUPS },
  "tabs.list": { groups: BOX_GROUPS },
  "nav.link": { groups: BOX_GROUPS },
  "nav.current": { groups: BOX_GROUPS },
  "nav.cta": { groups: BOX_GROUPS },
  "breadcrumb.separator": { groups: BOX_GROUPS },
};

// --- Targets and states -----------------------------------------------------

const POINTER: readonly StateAtom[] = ["hover", "active"];
const FOCUSABLE: readonly StateAtom[] = [
  "hover",
  "focus",
  "focus-visible",
  "active",
];
const FIELD_STATES: readonly StateAtom[] = [
  ...FOCUSABLE,
  "invalid",
  "required",
  "read-only",
  "placeholder-shown",
  "disabled",
];

const PROFILE_ATOMS: Readonly<Record<StylingProfileId, readonly StateAtom[]>> =
  {
    page: [],
    body: [],
    container: [...POINTER, "focus-within"],
    text: POINTER,
    button: [...FOCUSABLE, "disabled", "expanded"],
    link: [...FOCUSABLE, "disabled", "current", "expanded"],
    list: [...POINTER, "focus-within"],
    "list-item": POINTER,
    field: FIELD_STATES,
    textarea: FIELD_STATES,
    select: [...FOCUSABLE, "invalid", "required", "disabled"],
    option: [],
    "toggle-checkbox": [
      ...FOCUSABLE,
      "checked",
      "indeterminate",
      "invalid",
      "required",
      "disabled",
    ],
    "toggle-radio": [
      ...FOCUSABLE,
      "checked",
      "invalid",
      "required",
      "disabled",
    ],
    "progress-native": ["hover", "indeterminate"],
    "progress-custom": ["hover", "indeterminate"],
    "media-image": ["hover"],
    "media-video": ["hover", "focus-within"],
    "media-audio": ["hover", "focus-within"],
    embed: ["hover"],
    svg: ["hover"],
    table: ["hover"],
    "table-section": ["hover"],
    "table-row": ["hover"],
    "table-cell": ["hover"],
    "table-caption": ["hover"],
    dialog: ["open", "focus-within"],
    divider: ["hover"],
  };

const TEXT_FIELD_INPUT_TYPES: ReadonlySet<string> = new Set([
  "text",
  "email",
  "password",
  "search",
  "url",
  "tel",
  "number",
]);
const SCROLLBAR_TARGETS: readonly StyleTargetId[] = [
  "scrollbar",
  "scrollbar.thumb",
  "scrollbar.track",
];
const TEXT_PSEUDOS: readonly StyleTargetId[] = [
  "before",
  "after",
  "selection",
  "first-line",
  "first-letter",
];

function profileTargets(
  node: Pick<EditorElementNode, "inputType" | "component">,
  profile: StylingProfileId,
): StyleTargetId[] {
  switch (profile) {
    case "page":
      return ["element", "selection"];
    case "container":
      return [
        "element",
        ...TEXT_PSEUDOS,
        ...SCROLLBAR_TARGETS,
        "group.first",
        "group.last",
      ];
    case "text":
      return ["element", ...TEXT_PSEUDOS];
    case "button":
    case "link":
    case "divider":
      return ["element", "before", "after", "selection"];
    case "list":
      return ["element", "before", "after", "list.first", "list.last"];
    case "list-item":
      return ["element", ...TEXT_PSEUDOS, "marker"];
    case "field": {
      const type = node.inputType ?? "text";
      return [
        "element",
        ...(TEXT_FIELD_INPUT_TYPES.has(type) ? (["placeholder"] as const) : []),
        ...(type === "search" ? (["search.cancel"] as const) : []),
        ...(type === "number" ? (["number.spin"] as const) : []),
      ];
    }
    case "textarea":
      return ["element", "placeholder", ...SCROLLBAR_TARGETS];
    case "select":
      return ["element", "select.arrow"];
    case "toggle-checkbox":
    case "toggle-radio":
      return ["element", "toggle.box", "toggle.indicator"];
    case "progress-native":
      return ["element", "progress.track", "progress.fill"];
    case "progress-custom":
      return [
        "element",
        "progress.track",
        "progress.fill",
        "progress.segment",
        "progress.label",
      ];
    case "table":
      return [
        "element",
        "before",
        "after",
        "table.headerRow",
        "table.bodyRow",
        "table.altRow",
        "table.cell",
        "table.headerCell",
        "table.caption",
      ];
    case "dialog":
      return ["element", "before", "after", "backdrop", ...SCROLLBAR_TARGETS];
    default:
      return ["element"];
  }
}

/** Role-group targets a component root adds (Report 1 §5.2), with their own atoms. */
const PAGINATION_ROLE_TARGETS: readonly (readonly [
  Exclude<StyleTargetId, "element">,
  readonly StateAtom[],
])[] = [
  ["pagination.page", ["hover", "focus-visible", "active", "current"]],
  ["pagination.current", ["hover", "focus-visible"]],
  ["pagination.prevNext", ["hover", "focus-visible", "active", "disabled"]],
  ["pagination.disabled", []],
  ["pagination.ellipsis", []],
];

/** Curated compound states (N6), in canonical order, per (profile or role-group target). */
const CURATED_COMPOUNDS: Readonly<
  Partial<
    Record<StylingProfileId | StyleTargetId, readonly (readonly StateAtom[])[]>
  >
> = {
  "toggle-checkbox": [
    ["hover", "checked"],
    ["focus-visible", "checked"],
  ],
  "toggle-radio": [
    ["hover", "checked"],
    ["focus-visible", "checked"],
  ],
  field: [["focus", "invalid"]],
  textarea: [["focus", "invalid"]],
  "pagination.page": [
    ["hover", "current"],
    ["focus-visible", "current"],
  ],
};

/** Atoms an ancestor scope may use (O6): states another element can be in. */
export const ANCESTOR_ATOMS: readonly StateAtom[] = [
  "hover",
  "active",
  "focus-visible",
  "focus-within",
  "checked",
  "disabled",
  "current",
  "expanded",
  "open",
  "selected",
];

export interface TargetCapability {
  target: StyleTargetId;
  atoms: readonly StateAtom[];
  compounds: readonly (readonly StateAtom[])[];
  groups: ReadonlySet<StyleRuleGroupKey>;
  fields?: FieldAllowList;
}

export interface StylingCapabilities {
  profile: StylingProfileId;
  targets: ReadonlyMap<StyleTargetId, TargetCapability>;
}

/** Everything the registry offers for this node, or undefined for an unknown tag. */
export function getStylingCapabilities(
  node: Pick<
    EditorElementNode,
    "tag" | "inputType" | "progressVariant" | "component"
  >,
): StylingCapabilities | undefined {
  const profile = resolveStylingProfile(node);
  if (!profile) return undefined;
  const baseAtoms = PROFILE_ATOMS[profile];
  const compounds = CURATED_COMPOUNDS[profile] ?? [];
  const targets = new Map<StyleTargetId, TargetCapability>();
  for (const target of profileTargets(node, profile)) {
    if (target === "element") {
      targets.set(target, {
        target,
        atoms: baseAtoms,
        compounds,
        groups: elementGroups(node, profile),
      });
      continue;
    }
    const spec = NON_ELEMENT_TARGET_GROUPS[target];
    targets.set(target, {
      target,
      atoms: baseAtoms,
      compounds,
      groups: new Set(spec.groups),
      fields: spec.fields,
    });
  }
  if (node.component === "pagination") {
    for (const [target, atoms] of PAGINATION_ROLE_TARGETS) {
      targets.set(target, {
        target,
        atoms,
        compounds: CURATED_COMPOUNDS[target] ?? [],
        groups: new Set(NON_ELEMENT_TARGET_GROUPS[target].groups),
      });
    }
  }
  return { profile, targets };
}

/** The atoms a profile's own element can be in (used to check ancestor conditions). */
export function profileAtoms(profile: StylingProfileId): readonly StateAtom[] {
  return PROFILE_ATOMS[profile];
}

export function isCuratedCompound(
  capability: TargetCapability,
  atoms: readonly StateAtom[],
): boolean {
  const sorted = [...atoms]
    .sort((a, b) => stateAtomRank(a) - stateAtomRank(b))
    .join("+");
  return capability.compounds.some((compound) => compound.join("+") === sorted);
}

/** All targets any variant of this element offers (to tell "inactive in this variant" from "never applicable"). */
export function targetsAcrossVariants(
  node: Pick<
    EditorElementNode,
    "tag" | "inputType" | "progressVariant" | "component"
  >,
): ReadonlySet<StyleTargetId> {
  if (node.tag !== "progress")
    return new Set(getStylingCapabilities(node)?.targets.keys() ?? []);
  return new Set([
    ...(getStylingCapabilities({
      ...node,
      progressVariant: "native",
    })?.targets.keys() ?? []),
    ...(getStylingCapabilities({
      ...node,
      progressVariant: "custom",
    })?.targets.keys() ?? []),
  ]);
}

// --- Authoring availability ------------------------------------------------

/**
 * Which BC-17 foundation features the editor can already AUTHOR. The
 * registry above says what CSS applies; this says what the build offers.
 * Everything is false in BC-17.2 — later checkpoints switch features on
 * as their UI and rendering land — so representing a capability in the
 * registry never exposes an unfinished control.
 */
export const STYLING_AUTHORING_AVAILABILITY = {
  styleRules: false,
  pseudoContent: false,
  counters: false,
  logicalProperties: false,
  direction: false,
  outline: false,
  progressVariants: false,
  styleAssets: false,
} as const satisfies Record<string, boolean>;

export type StylingFeature = keyof typeof STYLING_AUTHORING_AVAILABILITY;

export function isStylingFeatureAuthorable(feature: StylingFeature): boolean {
  return STYLING_AUTHORING_AVAILABILITY[feature];
}
