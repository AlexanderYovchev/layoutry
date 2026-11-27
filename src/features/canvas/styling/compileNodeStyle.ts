import type { CSSProperties } from "react";
import { escapeCssString } from "@/features/canvas/styling/cssEscape";
import { validateCssDeclarationValue } from "@/features/canvas/styling/cssValueSafety";
import {
  contentValue,
  foundationDeclarations,
  physicalGroupStyle,
  type GeneratedDeclaration,
  type GroupDeclarationContext,
} from "@/features/canvas/styling/groupDeclarations";
import {
  hasInnerMediaElement,
  resolveNodeStyleRecipe,
} from "@/features/canvas/styling/resolveNodeStyleRecipe";
import { serializeStyleObject } from "@/features/canvas/styling/serializeStyleObject";
import {
  atomSelector,
  conditionBucket,
} from "@/features/canvas/styling/stateSelectors";
import {
  STYLE_BUCKET,
  type NodeStyleIR,
  type StyleDiagnostic,
  type StyleIrRule,
  type StyleSelector,
  type StyleSurface,
} from "@/features/canvas/styling/styleIr";
import type { CssDeclaration } from "@/features/canvas/types/documentDefaultStyle";
import {
  DOCUMENT_DEFAULT_STYLE_IDS,
  getDocumentDefaultStyle,
  type DocumentDefaultStyleId,
} from "@/features/canvas/utils/documentDefaultStyles";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveMediaFitStyle } from "@/features/canvas/utils/resolveMediaFitStyle";
import {
  computeInactiveStyling,
  resolveAncestorScope,
  type InactiveStyling,
} from "@/features/editor/rules/inactiveStyling";
import { evaluateContextCapability } from "@/features/editor/rules/stylingContextPredicates";
import { counterOperationRefs } from "@/features/editor/types/counters";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import {
  getPaginationParts,
  isPaginationNode,
} from "@/features/editor/types/pagination";
import { getProgressVariant } from "@/features/editor/types/progress";
import {
  STYLE_RULE_GROUP_KEYS,
  styleTargetKind,
  type StyleRule,
  type StyleRuleGroups,
  type StyleTargetId,
} from "@/features/editor/types/styleRules";

/*
 * BC-17.3 — the shared, pure stylesheet compiler (BC-17.1.3 Report 1 §8).
 * One function turns one authored node into its NodeStyleIR for any
 * surface. It reuses the existing style recipes and resolvers unchanged
 * (the base styling, exactly as the Canvas and export always composed it)
 * and adds the BC-17.2 rules and foundation fields. No DOM, no React, no
 * store: equal input gives equal output.
 */

export interface CompileNodeStyleInput {
  node: EditorElementNode;
  /** The document root to the node's parent, root first. */
  ancestors: readonly EditorElementNode[];
  parentLayoutMode: ContainerLayoutMode;
  parentFlowDisplay: FlowDisplayMode;
  surface: StyleSurface;
  nodeClass: string;
  innerClass?: string;
  /** The generated class of another node (role-group members, ancestor scopes); undefined when it has none. */
  classFor: (nodeId: string) => string | undefined;
  /** Document counter definition id → printed identifier. */
  counterIdentifiers: ReadonlyMap<string, string>;
  /** Design/Preview print the default presentations into the node's own order-0 rule; the export prints shared rules instead. */
  includeDefaults: boolean;
  /** Export URL policy for background images (checks, packaging, diagnostics); others keep the URL as written. */
  resolveUrl?: (
    nodeId: string,
    property: string,
    url: string,
  ) => string | undefined;
  /** Receives every diagnostic as it happens (the export reports them in order); they are also collected in the IR. */
  onDiagnostic?: (diagnostic: StyleDiagnostic) => void;
  /** Compile only the base styling or only the rules (the export builds the base while walking, the rules once every class exists). */
  only?: "base" | "rules";
}

const CSS_URL_VALUE = /^url\(("(?:[^"\\]|\\[\s\S])*")\)$/;

/**
 * Converts a style object into validated declarations (the export's
 * EXPORT-1.2 rules, now shared): React's value serialization, the
 * structural injection check, colour and font-family validation, and
 * url() re-serialized with CSS string escaping. A value that fails is
 * dropped with a diagnostic — which is also what a browser does with an
 * inline value it can't parse.
 */
export function validatedDeclarations(
  nodeId: string,
  style: CSSProperties,
  report: (diagnostic: StyleDiagnostic) => void,
  resolveUrl?: CompileNodeStyleInput["resolveUrl"],
): GeneratedDeclaration[] {
  const declarations: GeneratedDeclaration[] = [];
  for (const [property, value] of serializeStyleObject(style)) {
    if (property === "background-image" && value.startsWith("url(")) {
      // resolveBackgroundStyle writes url(<JSON string>); re-check the URL
      // and re-serialize it with CSS (not JSON) string escaping.
      const match = CSS_URL_VALUE.exec(value);
      let raw: unknown;
      try {
        raw = match ? JSON.parse(match[1]) : undefined;
      } catch {
        raw = undefined;
      }
      if (typeof raw !== "string") {
        report({
          nodeId,
          severity: "warning",
          code: "invalid-css-value",
          message:
            "The background image value could not be read, so it was not exported.",
          property,
        });
        continue;
      }
      const url = resolveUrl ? resolveUrl(nodeId, property, raw) : raw;
      if (url !== undefined)
        declarations.push([property, `url(${escapeCssString(url)})`, true]);
      continue;
    }
    const check = validateCssDeclarationValue(property, value);
    if (check.ok) declarations.push([property, value]);
    else
      report({
        nodeId,
        severity: "warning",
        code: check.code,
        message: check.message,
        property,
      });
  }
  return declarations;
}

function plain(
  declarations: readonly GeneratedDeclaration[],
): CssDeclaration[] {
  return declarations.map(([property, value]) => [property, value]);
}

function validatedFoundation(
  nodeId: string,
  declarations: readonly GeneratedDeclaration[],
  report: (diagnostic: StyleDiagnostic) => void,
): GeneratedDeclaration[] {
  const out: GeneratedDeclaration[] = [];
  for (const declaration of declarations) {
    if (declaration.length === 3) {
      out.push(declaration);
      continue;
    }
    const check = validateCssDeclarationValue(declaration[0], declaration[1]);
    if (check.ok) out.push(declaration);
    else
      report({
        nodeId,
        severity: "warning",
        code: check.code,
        message: check.message,
        property: declaration[0],
      });
  }
  return out;
}

function hasFoundationData(node: EditorElementNode): boolean {
  return (
    node.styleRules !== undefined ||
    node.logicalSize !== undefined ||
    node.position?.insetLogical !== undefined ||
    node.outline !== undefined ||
    node.counters !== undefined ||
    node.spacing?.marginLogical !== undefined ||
    node.spacing?.paddingLogical !== undefined ||
    node.border?.borderLogical !== undefined ||
    node.borderRadius?.radiusLogical !== undefined ||
    node.typography?.direction !== undefined ||
    node.typography?.unicodeBidi !== undefined ||
    node.typography?.writingMode !== undefined ||
    node.typography?.textOrientation !== undefined
  );
}

/** The node's default presentations as one order-0 declaration list (table order: a later entry wins), plus @media and ::backdrop parts. */
function defaultRules(
  nodeClass: string,
  defaults: readonly DocumentDefaultStyleId[],
): StyleIrRule[] {
  if (defaults.length === 0) return [];
  const used = new Set(defaults);
  const ordered = DOCUMENT_DEFAULT_STYLE_IDS.filter((id) => used.has(id));
  const selector: StyleSelector = { subject: nodeClass, where: true };
  const rules: StyleIrRule[] = [
    {
      bucket: STYLE_BUCKET.defaults,
      tier: 1,
      selector,
      declarations: ordered.flatMap((id) => [
        ...getDocumentDefaultStyle(id).declarations,
      ]),
    },
  ];
  for (const id of ordered) {
    const entry = getDocumentDefaultStyle(id);
    if (entry.media)
      rules.push({
        bucket: STYLE_BUCKET.defaults,
        tier: 1,
        selector,
        media: entry.media.query,
        declarations: [...entry.media.declarations],
      });
    if (entry.backdrop)
      rules.push({
        bucket: STYLE_BUCKET.defaults,
        tier: 1,
        selector: { ...selector, pseudoElement: "::backdrop" },
        declarations: [...entry.backdrop],
      });
  }
  return rules;
}

const PSEUDO_ELEMENTS: Partial<Record<StyleTargetId, string>> = {
  before: "::before",
  after: "::after",
  placeholder: "::placeholder",
  marker: "::marker",
  selection: "::selection",
  backdrop: "::backdrop",
  "first-line": "::first-line",
  "first-letter": "::first-letter",
};

/** Native vendor parts: one rule per vendor selector (an unknown selector would invalidate a selector list). */
const VENDOR_PARTS: Partial<Record<StyleTargetId, readonly (string | null)[]>> =
  {
    // Gecko has no track pseudo-element: its track is the element box itself (null).
    "progress.track": [null, "::-webkit-progress-bar"],
    "progress.fill": ["::-webkit-progress-value", "::-moz-progress-bar"],
    scrollbar: ["::-webkit-scrollbar"],
    "scrollbar.thumb": ["::-webkit-scrollbar-thumb"],
    "scrollbar.track": ["::-webkit-scrollbar-track"],
    "search.cancel": ["::-webkit-search-cancel-button"],
    "number.spin": [
      "::-webkit-inner-spin-button",
      "::-webkit-outer-spin-button",
    ],
  };

const STRUCTURAL_CHAINS: Partial<Record<StyleTargetId, readonly string[]>> = {
  "list.first": [":first-child"],
  "list.last": [":last-child"],
  "group.first": [":first-child"],
  "group.last": [":last-child"],
  "table.headerRow": ["thead", "tr"],
  "table.bodyRow": ["tbody", "tr"],
  "table.altRow": ["tbody", "tr:nth-child(even)"],
  "table.cell": [":is(thead, tbody, tfoot)", "tr", "td"],
  "table.headerCell": [":is(thead, tbody, tfoot)", "tr", "th"],
  "table.caption": ["caption"],
};

interface TargetSelector {
  chain?: readonly string[];
  pseudoElement?: string;
  conditions?: readonly string[];
  /** Extra declarations a vendor part needs on the element itself (appearance: none). */
  tier: 0 | 1;
}

/** The selectors a rule's target compiles to, or a reason it can't render yet. */
function targetSelectors(
  target: StyleTargetId,
  node: EditorElementNode,
  input: CompileNodeStyleInput,
): TargetSelector[] | string {
  if (target === "element") return [{ tier: 1 }];
  const pseudo = PSEUDO_ELEMENTS[target];
  if (pseudo) return [{ pseudoElement: pseudo, tier: 1 }];
  const vendor = VENDOR_PARTS[target];
  if (vendor)
    return vendor.map((pseudoElement) =>
      pseudoElement === null ? { tier: 1 } : { pseudoElement, tier: 1 },
    );
  const chain = STRUCTURAL_CHAINS[target];
  if (chain) return [{ chain, tier: 1 }];
  if (styleTargetKind(target) === "role-group") {
    if (!isPaginationNode(node))
      return "it needs its component, which is not available yet";
    const parts = getPaginationParts(node);
    const ids = (() => {
      switch (target) {
        case "pagination.page":
        case "pagination.current":
          return parts.pages.map((page) => page.id);
        case "pagination.prevNext":
        case "pagination.disabled":
          return [parts.controls.previous?.id, parts.controls.next?.id].filter(
            (id): id is string => id !== undefined,
          );
        case "pagination.ellipsis":
          return [...parts.roleById]
            .filter(([, role]) => role === "ellipsis")
            .map(([id]) => id);
        default:
          return [];
      }
    })();
    const members = ids
      .map((id) => input.classFor(id))
      .filter((name): name is string => name !== undefined);
    if (members.length === 0) return [];
    const conditions =
      target === "pagination.current"
        ? ['[aria-current="page"]']
        : target === "pagination.disabled"
          ? ['[aria-disabled="true"]']
          : [];
    return [
      {
        chain: [`:is(${members.map((name) => `.${name}`).join(", ")})`],
        conditions,
        tier: 0,
      },
    ];
  }
  return "its part is rendered from a later checkpoint (BC-17.12/17.13)";
}

/** A copy of the rule's groups with the inactive groups and fields removed (inactive data stays stored, it just doesn't print). */
function activeGroups(
  rule: StyleRule,
  inactive: InactiveStyling | undefined,
): StyleRuleGroups {
  const fields =
    inactive?.fields.filter(
      (field) =>
        field.source.kind === "rule" && field.source.ruleId === rule.id,
    ) ?? [];
  if (fields.length === 0) return rule.groups;
  const groups: Record<string, unknown> = { ...rule.groups };
  for (const field of fields) {
    if (field.field === undefined) {
      delete groups[field.group];
      continue;
    }
    const value = groups[field.group];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const copy: Record<string, unknown> = { ...value };
      delete copy[field.field];
      groups[field.group] = copy;
    }
  }
  const result: StyleRuleGroups = {};
  for (const key of STYLE_RULE_GROUP_KEYS)
    if (groups[key] !== undefined)
      Object.assign(result, { [key]: groups[key] });
  return result;
}

function compileRules(
  input: CompileNodeStyleInput,
  groupContext: GroupDeclarationContext,
  inactive: InactiveStyling | undefined,
  report: (diagnostic: StyleDiagnostic) => void,
): StyleIrRule[] {
  const { node } = input;
  const rules: StyleIrRule[] = [];
  const inactiveRules = new Set(inactive?.rules.map((entry) => entry.ruleId));
  const element = {
    tag: node.tag,
    customProgress:
      node.tag === "progress" && getProgressVariant(node) === "custom",
  };
  for (const rule of node.styleRules ?? []) {
    if (inactiveRules.has(rule.id)) continue;
    const selectors = targetSelectors(rule.target, node, input);
    if (typeof selectors === "string") {
      report({
        nodeId: node.id,
        severity: "info",
        code: "style-target-not-rendered",
        message: `A "${rule.target}" rule is kept but not rendered: ${selectors}.`,
      });
      continue;
    }
    const conditions = (rule.condition.self ?? []).map((atom) =>
      atomSelector(atom, input.surface, element),
    );
    let ancestor: StyleSelector["ancestor"];
    if (rule.condition.ancestor) {
      const resolved = resolveAncestorScope(
        rule.condition.ancestor.scope,
        input.ancestors,
      );
      const className = resolved ? input.classFor(resolved.id) : undefined;
      if (!resolved || !className) continue;
      ancestor = {
        className,
        condition: atomSelector(rule.condition.ancestor.atom, input.surface, {
          tag: resolved.tag,
          customProgress:
            resolved.tag === "progress" &&
            getProgressVariant(resolved) === "custom",
        }),
      };
    }
    const groups = activeGroups(rule, inactive);
    const { mediaFit, ...boxGroups } = groups;
    const declarations = [
      ...validatedDeclarations(
        node.id,
        physicalGroupStyle(node, boxGroups, groupContext),
        report,
        input.resolveUrl,
      ),
      ...validatedFoundation(
        node.id,
        foundationDeclarations(boxGroups, groupContext, {
          logicalInsets: true,
          logicalSize: true,
        }),
        report,
      ),
    ];
    if (rule.content) {
      const value = contentValue(rule.content, groupContext);
      if (value !== undefined) declarations.push(["content", value, true]);
    }
    const bucket = conditionBucket(rule.condition);
    const needsAppearance =
      rule.target === "progress.track" || rule.target === "progress.fill";
    for (const target of selectors) {
      const selector: StyleSelector = {
        subject: input.nodeClass,
        ...(target.chain ? { chain: target.chain } : {}),
        conditions: [...(target.conditions ?? []), ...conditions],
        ...(ancestor ? { ancestor } : {}),
        ...(target.pseudoElement
          ? { pseudoElement: target.pseudoElement }
          : {}),
      };
      const extra: CssDeclaration[] =
        needsAppearance && !target.pseudoElement
          ? [
              ["-webkit-appearance", "none"],
              ["appearance", "none"],
            ]
          : [];
      if (declarations.length > 0 || extra.length > 0)
        rules.push({
          bucket,
          tier: target.tier,
          selector,
          declarations: [...extra, ...plain(declarations)],
        });
    }
    // Media fit styles the genuine inner media element, as in the base styling.
    if (mediaFit && input.innerClass) {
      const fitDeclarations = validatedDeclarations(
        node.id,
        resolveMediaFitStyle({ id: node.id, tag: node.tag, mediaFit }),
        report,
      );
      if (fitDeclarations.length > 0)
        rules.push({
          bucket,
          tier: 1,
          selector: {
            subject: input.innerClass,
            conditions,
            ...(ancestor ? { ancestor } : {}),
          },
          declarations: plain(fitDeclarations),
        });
    }
  }
  return rules;
}

/** Every document counter the node's styling references (its invalidation dependencies). */
function counterRefsOf(node: EditorElementNode): string[] {
  const ids = new Set<string>();
  const add = (refs: ReturnType<typeof counterOperationRefs>) => {
    for (const ref of refs) if (ref.kind === "document") ids.add(ref.id);
  };
  add(counterOperationRefs(node.counters));
  for (const rule of node.styleRules ?? []) {
    add(counterOperationRefs(rule.groups.counters));
    if (rule.content?.kind === "parts")
      for (const part of rule.content.parts)
        if (part.kind === "counter" || part.kind === "counters")
          add([part.counter]);
  }
  return [...ids];
}

/**
 * The base rule's declarations: the recipe's authored style, validated,
 * then the BC-17.2 foundation fields (outline, logical twins after every
 * physical declaration, direction, counters). Shared by every surface.
 */
export function compileBaseDeclarations(
  node: EditorElementNode,
  parent: EditorElementNode | undefined,
  recipeStyle: CSSProperties,
  context: GroupDeclarationContext,
  report: (diagnostic: StyleDiagnostic) => void,
  resolveUrl?: CompileNodeStyleInput["resolveUrl"],
): CssDeclaration[] {
  const applicable = (capability: "logicalInsets" | "logicalSize") =>
    evaluateContextCapability(capability, node, parent).status === "applicable";
  return plain([
    ...validatedDeclarations(node.id, recipeStyle, report, resolveUrl),
    ...(hasFoundationData(node)
      ? validatedFoundation(
          node.id,
          foundationDeclarations(node, context, {
            logicalInsets: applicable("logicalInsets"),
            logicalSize: applicable("logicalSize"),
          }),
          report,
        )
      : []),
  ]);
}

/** Compiles one node. A failure in one stage never takes the rest of the node — or the document — with it. */
export function compileNodeStyle(input: CompileNodeStyleInput): NodeStyleIR {
  const { node } = input;
  const diagnostics: StyleDiagnostic[] = [];
  const report = (diagnostic: StyleDiagnostic) => {
    diagnostics.push(diagnostic);
    input.onDiagnostic?.(diagnostic);
  };
  const isPreview = input.surface !== "design";
  const context = {
    parentLayoutMode: input.parentLayoutMode,
    parentFlowDisplay: input.parentFlowDisplay,
    isPreview,
  };
  const groupContext: GroupDeclarationContext = {
    parentLayoutMode: input.parentLayoutMode,
    isPreview,
    counterIdentifiers: input.counterIdentifiers,
  };
  const rules: StyleIrRule[] = [];
  const parent = input.ancestors.at(-1);
  const inactive = hasFoundationData(node)
    ? computeInactiveStyling(node, input.ancestors)
    : undefined;

  if (input.only !== "rules")
    try {
      const recipe = resolveNodeStyleRecipe(node, context);
      if (input.includeDefaults)
        rules.push(...defaultRules(input.nodeClass, recipe.defaults));
      const base = compileBaseDeclarations(
        node,
        parent,
        recipe.style,
        groupContext,
        report,
        input.resolveUrl,
      );
      if (base.length > 0)
        rules.push({
          bucket: STYLE_BUCKET.base,
          tier: 1,
          selector: { subject: input.nodeClass },
          declarations: base,
        });
      if (input.innerClass && recipe.innerStyle && hasInnerMediaElement(node)) {
        const inner = validatedDeclarations(node.id, recipe.innerStyle, report);
        if (inner.length > 0)
          rules.push({
            bucket: STYLE_BUCKET.base,
            tier: 1,
            selector: { subject: input.innerClass },
            declarations: plain(inner),
          });
      }
    } catch (error) {
      report({
        nodeId: node.id,
        severity: "error",
        code: "style-compile-failed",
        message: `This element's styling could not be compiled (${error instanceof Error ? error.message : String(error)}); its geometry was kept.`,
      });
      // Committed geometry is compiled on its own, so a failure elsewhere never moves the element.
      try {
        const geometry = validatedDeclarations(
          node.id,
          elementPositionStyle(node, input.parentLayoutMode) ?? {},
          report,
        );
        if (geometry.length > 0)
          rules.push({
            bucket: STYLE_BUCKET.base,
            tier: 1,
            selector: { subject: input.nodeClass },
            declarations: plain(geometry),
          });
      } catch {
        // Nothing more can be kept; the diagnostic above already says why.
      }
    }

  if (input.only !== "base")
    try {
      rules.push(...compileRules(input, groupContext, inactive, report));
    } catch (error) {
      report({
        nodeId: node.id,
        severity: "error",
        code: "style-compile-failed",
        message: `This element's state and part styling could not be compiled (${error instanceof Error ? error.message : String(error)}); its base styling was kept.`,
      });
    }

  return {
    nodeId: node.id,
    nodeClass: input.nodeClass,
    ...(input.innerClass ? { innerClass: input.innerClass } : {}),
    rules,
    keyframeRefs: [],
    counterRefs: counterRefsOf(node),
    svgDefs: [],
    diagnostics,
    hasTransition: rules.some((rule) =>
      rule.declarations.some(
        ([property]) => property === "transition-duration",
      ),
    ),
  };
}
