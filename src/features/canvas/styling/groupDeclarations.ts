import type { CSSProperties } from "react";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveShapeStyle } from "@/features/canvas/utils/resolveShapeStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { resolveTransformStyle } from "@/features/canvas/utils/resolveTransformStyle";
import { resolveTransitionStyle } from "@/features/canvas/utils/resolveTransitionStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import { escapeCssString } from "@/features/canvas/styling/cssEscape";
import type { CssDeclaration } from "@/features/canvas/types/documentDefaultStyle";
import type {
  CounterOperations,
  CounterRef,
  CounterStyleRef,
} from "@/features/editor/types/counters";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import type { LogicalSide } from "@/features/editor/types/logicalProperties";
import type { OffsetValue } from "@/features/editor/types/position";
import {
  CONTENT_GLYPHS,
  type PseudoContent,
  type StyleRuleGroups,
} from "@/features/editor/types/styleRules";
import {
  formatCssLength,
  type CssLengthValue,
} from "@/features/editor/types/typography";

/*
 * BC-17.3 — declarations for typed styling groups, shared by every rule
 * (and by the base rule for the BC-17.2 foundation fields). The existing
 * resolvers turn each physical group into CSS exactly as the base styling
 * always has; this file only adds what had no resolver yet: outline,
 * counters, logical twins, direction and writing mode, generated content.
 *
 * Physical then logical (Report 1 §4.10.4, §6.9): inside one rule every
 * physical declaration is emitted before every logical one, so a logical
 * value wins where both map to the same rendered side. Nothing is
 * converted; both stay as authored.
 */

export interface GroupDeclarationContext {
  parentLayoutMode: ContainerLayoutMode;
  /** Authored transitions run in Preview/Export only (the Design safety gate). */
  isPreview: boolean;
  /** Document counter definition id → printed CSS identifier (counterCssIdentifiers). */
  counterIdentifiers: ReadonlyMap<string, string>;
}

/** A declaration the printer must not re-validate: built here from typed values and escaped strings. */
export type TrustedDeclaration = readonly [
  property: string,
  value: string,
  trusted: true,
];
export type GeneratedDeclaration = CssDeclaration | TrustedDeclaration;

const LOGICAL_EDGE_PROPERTY: Readonly<Record<LogicalSide, string>> = {
  blockStart: "block-start",
  blockEnd: "block-end",
  inlineStart: "inline-start",
  inlineEnd: "inline-end",
};
const LOGICAL_SIDES: readonly LogicalSide[] = [
  "blockStart",
  "blockEnd",
  "inlineStart",
  "inlineEnd",
];

const SPACING_PROPERTIES = [
  [
    "margin",
    {
      top: "marginTop",
      right: "marginRight",
      bottom: "marginBottom",
      left: "marginLeft",
    },
  ],
  [
    "padding",
    {
      top: "paddingTop",
      right: "paddingRight",
      bottom: "paddingBottom",
      left: "paddingLeft",
    },
  ],
] as const;

function px(value: number): string {
  return value === 0 ? "0" : `${value}px`;
}

function offsetValue(value: OffsetValue): string {
  return value === "auto" ? "auto" : formatCssLength(value);
}

function length(value: CssLengthValue): string {
  return formatCssLength(value);
}

/** The physical CSS of a rule's groups, through the same resolvers the base styling uses. */
export function physicalGroupStyle(
  node: EditorElementNode,
  groups: StyleRuleGroups,
  context: GroupDeclarationContext,
): CSSProperties {
  // A node carrying only this rule's groups: the resolvers read nothing else.
  const synthetic: EditorElementNode = {
    id: node.id,
    tag: node.tag,
    ...groups,
  };
  const spacing: CSSProperties = {};
  for (const [box, keys] of SPACING_PROPERTIES) {
    const edges = groups.spacing?.[box];
    for (const side of ["top", "right", "bottom", "left"] as const) {
      const value = edges?.[side];
      if (value !== undefined) spacing[keys[side]] = value;
    }
  }
  return {
    ...resolvePositionStyle(synthetic),
    ...spacing,
    ...(groups.sizeConstraints
      ? resolveSizeConstraintsStyle(synthetic, context.parentLayoutMode)
      : undefined),
    ...resolveTypographyStyle(synthetic),
    ...resolveBackgroundStyle(synthetic),
    ...resolveBorderStyle(synthetic),
    ...resolveBorderRadiusStyle(synthetic),
    ...resolveBoxShadowStyle(synthetic),
    ...resolveFilterStyle(synthetic),
    ...resolveTransitionStyle(synthetic, context.isPreview),
    ...resolveTransformStyle(synthetic),
    ...resolveDisplayStyle(synthetic),
    ...resolveShapeStyle(synthetic),
  };
}

function counterName(
  ref: CounterRef,
  context: GroupDeclarationContext,
): string | undefined {
  return ref.kind === "builtin"
    ? ref.name
    : context.counterIdentifiers.get(ref.id);
}

function counterList(
  operations: CounterOperations[keyof CounterOperations],
  fallback: number,
  context: GroupDeclarationContext,
): string | undefined {
  if (!operations || operations.length === 0) return undefined;
  const parts: string[] = [];
  for (const operation of operations) {
    const name = counterName(operation.counter, context);
    if (name === undefined) continue;
    parts.push(`${name} ${operation.value ?? fallback}`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * The foundation groups with no existing resolver, in their fixed order:
 * outline, then the logical twins (after every physical declaration),
 * then direction / writing mode, then counters.
 */
export function foundationDeclarations(
  groups: Pick<
    StyleRuleGroups,
    | "spacing"
    | "position"
    | "border"
    | "borderRadius"
    | "logicalSize"
    | "typography"
    | "outline"
    | "counters"
  >,
  context: GroupDeclarationContext,
  options: { logicalInsets: boolean; logicalSize: boolean },
): GeneratedDeclaration[] {
  const out: GeneratedDeclaration[] = [];
  const outline = groups.outline;
  if (outline?.width) out.push(["outline-width", length(outline.width)]);
  if (outline?.style) out.push(["outline-style", outline.style]);
  if (outline?.color) out.push(["outline-color", outline.color]);
  if (outline?.offset) out.push(["outline-offset", length(outline.offset)]);

  for (const box of ["margin", "padding"] as const) {
    const edges =
      groups.spacing?.[box === "margin" ? "marginLogical" : "paddingLogical"];
    for (const side of LOGICAL_SIDES) {
      const value = edges?.[side];
      if (value !== undefined)
        out.push([`${box}-${LOGICAL_EDGE_PROPERTY[side]}`, px(value)]);
    }
  }
  if (options.logicalInsets) {
    for (const side of LOGICAL_SIDES) {
      const value = groups.position?.insetLogical?.[side];
      if (value !== undefined)
        out.push([`inset-${LOGICAL_EDGE_PROPERTY[side]}`, offsetValue(value)]);
    }
  }
  for (const side of LOGICAL_SIDES) {
    const border = groups.border?.borderLogical?.[side];
    if (!border) continue;
    const name = `border-${LOGICAL_EDGE_PROPERTY[side]}`;
    if (border.width) out.push([`${name}-width`, length(border.width)]);
    if (border.style) out.push([`${name}-style`, border.style]);
    if (border.color) out.push([`${name}-color`, border.color]);
  }
  const radii = groups.borderRadius?.radiusLogical;
  for (const [corner, property] of [
    ["startStart", "border-start-start-radius"],
    ["startEnd", "border-start-end-radius"],
    ["endStart", "border-end-start-radius"],
    ["endEnd", "border-end-end-radius"],
  ] as const) {
    const value = radii?.[corner];
    if (value) out.push([property, length(value)]);
  }
  if (options.logicalSize) {
    const size = groups.logicalSize;
    for (const [field, property] of [
      ["inlineSize", "inline-size"],
      ["blockSize", "block-size"],
      ["minInlineSize", "min-inline-size"],
      ["maxInlineSize", "max-inline-size"],
      ["minBlockSize", "min-block-size"],
      ["maxBlockSize", "max-block-size"],
    ] as const) {
      const value = size?.[field];
      if (value) out.push([property, length(value)]);
    }
  }
  const typography = groups.typography;
  if (typography?.direction) out.push(["direction", typography.direction]);
  if (typography?.unicodeBidi)
    out.push(["unicode-bidi", typography.unicodeBidi]);
  if (typography?.writingMode)
    out.push(["writing-mode", typography.writingMode]);
  if (typography?.textOrientation)
    out.push(["text-orientation", typography.textOrientation]);

  const counters = groups.counters;
  const reset = counterList(counters?.reset, 0, context);
  const increment = counterList(counters?.increment, 1, context);
  const set = counterList(counters?.set, 0, context);
  // CSS applies resets, then increments, then sets on one element.
  if (reset) out.push(["counter-reset", reset]);
  if (increment) out.push(["counter-increment", increment]);
  if (set) out.push(["counter-set", set]);
  return out;
}

function counterStyle(style: CounterStyleRef): string {
  return style.style;
}

/**
 * The `content` value for typed generated content (O7, P-4). Built only
 * from escaped strings, allow-listed glyphs, derived counter identifiers
 * and predefined counter styles; undefined when a counter can't resolve.
 */
export function contentValue(
  content: PseudoContent,
  context: GroupDeclarationContext,
): string | undefined {
  if (content.kind === "empty") return '""';
  const parts: string[] = [];
  for (const part of content.parts) {
    if (part.kind === "text") parts.push(escapeCssString(part.text));
    else if (part.kind === "glyph")
      parts.push(escapeCssString(CONTENT_GLYPHS[part.glyph]));
    else {
      const name = counterName(part.counter, context);
      if (name === undefined) return undefined;
      parts.push(
        part.kind === "counter"
          ? `counter(${name}, ${counterStyle(part.style)})`
          : `counters(${name}, ${escapeCssString(part.separator)}, ${counterStyle(part.style)})`,
      );
    }
  }
  const value = parts.join(" ");
  return content.altText === undefined
    ? value
    : `${value} / ${escapeCssString(content.altText)}`;
}
