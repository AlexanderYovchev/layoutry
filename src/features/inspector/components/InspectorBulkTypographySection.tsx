"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorBulkTextField } from "@/features/inspector/components/InspectorBulkTextField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { InspectorSharedValueNote } from "@/features/inspector/components/InspectorSharedValueNote";
import { useRenderedStyles } from "@/features/inspector/hooks/useRenderedStyles";
import {
  absoluteAuthoredColor,
  colorFieldValue,
  commonAuthored,
  effectiveRowState,
  effectiveValueOf,
  pxFieldValue,
  resolveSharedEffective,
  type EffectiveProperty,
} from "@/features/inspector/utils/effectiveCss";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  getTypographySettings,
  isValidCssColor,
  isValidFontSize,
  isValidLetterSpacing,
  isValidLineHeight,
  type FontStyleValue,
  type FontWeight,
  type TextAlign,
  type TextDecorationLine,
  type TypographySettings,
} from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkTypographySectionProps {
  nodes: readonly EditorElementNode[];
}

const NO_ACTIVE_OPTION = "";

// The same options and labels as the single-selection Typography section.
const FONT_WEIGHT_OPTIONS: { value: FontWeight; label: string }[] = [
  { value: 100, label: "Thin" },
  { value: 200, label: "Extra Light" },
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semi Bold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extra Bold" },
  { value: 900, label: "Black" },
];
const FONT_STYLE_OPTIONS: { value: FontStyleValue; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "italic", label: "Italic" },
  { value: "oblique", label: "Oblique" },
];
const TEXT_DECORATION_OPTIONS: { value: TextDecorationLine; label: string }[] = [
  { value: "none", label: "None" },
  { value: "underline", label: "Underline" },
  { value: "overline", label: "Overline" },
  { value: "line-through", label: "Line Through" },
];
const TEXT_ALIGN_OPTIONS: { value: TextAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "justify", label: "Justify" },
];

const MEASURED = ["font-family", "font-size", "font-weight", "font-style", "text-decoration-line", "color", "text-align", "line-height", "letter-spacing"] as const;
const length = (css: string): EffectiveProperty => ({ cssProperties: [css], kind: "length" });
const keyword = (css: string): EffectiveProperty => ({ cssProperties: [css], kind: "keyword" });

/** "Inter", sans-serif and inter, sans-serif are the same family list. */
function normalizeFamily(value: string): string {
  return value
    .split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, "").toLowerCase())
    .join(", ");
}

/** Layoutry pages are left-to-right (lang="en"), where text-align: start is left and end is right. */
function normalizeAlign(value: string): string {
  return value === "start" ? "left" : value === "end" ? "right" : value;
}

/** A safe font-family list: names, quotes, commas, spaces and hyphens only (no CSS-breaking characters). */
function isAcceptableFamily(value: string): boolean {
  return /^[\w\s,'"-]+$/.test(value) && value.trim() !== "";
}

/**
 * The multi-selection Typography surface (Checkpoint 1.15.2; complete
 * since BC-10.4): every single-selection Typography field, compared by its
 * EFFECTIVE value (BC-10.3) and editable together, each with its own
 * Reset. Used when the selected elements differ (another tag, other
 * authored typography); when they agree, InspectorMultiNodeSummary shows
 * the real single-selection section instead, fanned out to all of them.
 * Numbers typed here are px (font size, line height, letter spacing);
 * the single-selection section offers the other units.
 */
export function InspectorBulkTypographySection({ nodes }: InspectorBulkTypographySectionProps) {
  const setElementsTypographyField = useEditorStore((state) => state.setElementsTypographyField);
  const ids = nodes.map((node) => node.id);
  const measured = useRenderedStyles(ids, MEASURED);
  const typography = nodes.map((node) => getTypographySettings(node));

  /** One field's shared effective value: measured, else the authored value when it is absolute. */
  function shared<T>(
    property: EffectiveProperty,
    authoredAbsolute: (settings: TypographySettings) => string | undefined,
    toField: (normalized: string) => T | undefined,
    normalize: (value: string) => string = (value) => value,
  ) {
    return resolveSharedEffective(
      nodes.map((node, index) => {
        const value = effectiveValueOf(node.id, property, measured, () => {
          const authored = authoredAbsolute(typography[index]);
          return authored === undefined ? undefined : [authored];
        });
        return value === undefined ? undefined : normalize(value);
      }),
      toField,
    );
  }
  const authoredPx = (value: { value: number; unit: string } | undefined) => (value && value.unit === "px" ? `${value.value}px` : undefined);
  const option = <V extends string | number>(options: readonly { value: V }[]) => (normalized: string) =>
    options.find((candidate) => String(candidate.value) === normalized)?.value;

  const authoredFamilies = typography.map((settings) => settings.fontFamily);
  const fontFamily = shared(keyword("font-family"), (settings) => settings.fontFamily, (normalized) => commonAuthored(authoredFamilies) ?? normalized, normalizeFamily);
  const fontSize = shared(length("font-size"), (settings) => authoredPx(settings.fontSize), pxFieldValue);
  const fontWeight = shared({ cssProperties: ["font-weight"], kind: "number" }, (settings) => (settings.fontWeight === undefined ? undefined : String(settings.fontWeight)), option(FONT_WEIGHT_OPTIONS));
  const fontStyle = shared(keyword("font-style"), (settings) => settings.fontStyle, option(FONT_STYLE_OPTIONS));
  const decoration = shared(keyword("text-decoration-line"), (settings) => settings.textDecorationLine, option(TEXT_DECORATION_OPTIONS));
  const authoredColors = typography.map((settings) => absoluteAuthoredColor(settings.color));
  const color = shared({ cssProperties: ["color"], kind: "color" }, (settings) => absoluteAuthoredColor(settings.color), (normalized) => commonAuthored(authoredColors) ?? colorFieldValue(normalized));
  const textAlign = shared(keyword("text-align"), (settings) => settings.textAlign, option(TEXT_ALIGN_OPTIONS), normalizeAlign);
  const lineHeight = shared(length("line-height"), (settings) => authoredPx(settings.lineHeight), pxFieldValue);
  const letterSpacing = shared(length("letter-spacing"), (settings) => authoredPx(settings.letterSpacing), pxFieldValue);

  const isAuthored = (field: keyof TypographySettings) => typography.some((settings) => settings[field] !== undefined);
  const reset = (field: keyof TypographySettings, label: string) => (
    <InspectorResetButton onReset={() => setElementsTypographyField(ids, field, undefined)} disabled={!isAuthored(field)} label={`Reset ${label} on all selected elements`} />
  );
  const labelOf = <V,>(options: readonly { value: V; label: string }[], value: V) => options.find((candidate) => candidate.value === value)?.label ?? NO_ACTIVE_OPTION;
  const valueOf = <V,>(options: readonly { value: V; label: string }[], label: string) => options.find((candidate) => candidate.label === label)?.value;

  return (
    <InspectorSection label="Typography">
      <InspectorPropertyRow label="Font family" state={effectiveRowState(fontFamily, isAuthored("fontFamily"))} reset={reset("fontFamily", "font family")}>
        <InspectorBulkTextField
          ariaLabel="Font family"
          shared={fontFamily}
          placeholder="Inter, sans-serif"
          onCommit={(value) => {
            if (!isAcceptableFamily(value)) return;
            setElementsTypographyField(ids, "fontFamily", value.trim());
          }}
        />
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Font size" variant="stack" state={effectiveRowState(fontSize, isAuthored("fontSize"))} reset={reset("fontSize", "font size")}>
        <InspectorBulkNumberField
          ariaLabel="Font size"
          shared={fontSize}
          min={1}
          onCommit={(value) => {
            if (!isValidFontSize(value)) return;
            setElementsTypographyField(ids, "fontSize", { value, unit: "px" });
          }}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow
        label="Weight"
        state={effectiveRowState(fontWeight, isAuthored("fontWeight"))}
        options={FONT_WEIGHT_OPTIONS.map((candidate) => candidate.label)}
        activeOption={fontWeight.kind === "same" ? labelOf(FONT_WEIGHT_OPTIONS, fontWeight.value) : NO_ACTIVE_OPTION}
        onSelect={(label) => {
          const value = valueOf(FONT_WEIGHT_OPTIONS, label);
          if (value !== undefined) setElementsTypographyField(ids, "fontWeight", value);
        }}
        reset={reset("fontWeight", "font weight")}
      />
      <InspectorSharedValueNote shared={fontWeight} />

      <InspectorSegmentedRow
        label="Style"
        state={effectiveRowState(fontStyle, isAuthored("fontStyle"))}
        options={FONT_STYLE_OPTIONS.map((candidate) => candidate.label)}
        activeOption={fontStyle.kind === "same" ? labelOf(FONT_STYLE_OPTIONS, fontStyle.value) : NO_ACTIVE_OPTION}
        onSelect={(label) => {
          const value = valueOf(FONT_STYLE_OPTIONS, label);
          if (value !== undefined) setElementsTypographyField(ids, "fontStyle", value);
        }}
        reset={reset("fontStyle", "font style")}
      />
      <InspectorSharedValueNote shared={fontStyle} />

      <InspectorSegmentedRow
        label="Decoration"
        state={effectiveRowState(decoration, isAuthored("textDecorationLine"))}
        options={TEXT_DECORATION_OPTIONS.map((candidate) => candidate.label)}
        activeOption={decoration.kind === "same" ? labelOf(TEXT_DECORATION_OPTIONS, decoration.value) : NO_ACTIVE_OPTION}
        onSelect={(label) => {
          const value = valueOf(TEXT_DECORATION_OPTIONS, label);
          if (value !== undefined) setElementsTypographyField(ids, "textDecorationLine", value);
        }}
        reset={reset("textDecorationLine", "text decoration")}
      />
      <InspectorSharedValueNote shared={decoration} />

      <InspectorPropertyRow label="Color" state={effectiveRowState(color, isAuthored("color"))} reset={reset("color", "text color")}>
        <InspectorBulkTextField
          ariaLabel="Text color"
          shared={color}
          placeholder="#000000"
          onCommit={(value) => {
            if (!isValidCssColor(value)) return;
            setElementsTypographyField(ids, "color", value);
          }}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow
        label="Align"
        state={effectiveRowState(textAlign, isAuthored("textAlign"))}
        options={TEXT_ALIGN_OPTIONS.map((candidate) => candidate.label)}
        activeOption={textAlign.kind === "same" ? labelOf(TEXT_ALIGN_OPTIONS, textAlign.value) : NO_ACTIVE_OPTION}
        onSelect={(label) => {
          const value = valueOf(TEXT_ALIGN_OPTIONS, label);
          if (value !== undefined) setElementsTypographyField(ids, "textAlign", value);
        }}
        reset={reset("textAlign", "text alignment")}
      />
      <InspectorSharedValueNote shared={textAlign} />

      <InspectorPropertyRow label="Line height (px)" variant="stack" state={effectiveRowState(lineHeight, isAuthored("lineHeight"))} reset={reset("lineHeight", "line height")}>
        <InspectorBulkNumberField
          ariaLabel="Line height"
          shared={lineHeight}
          min={0}
          onCommit={(value) => {
            if (!isValidLineHeight(value)) return;
            setElementsTypographyField(ids, "lineHeight", { value, unit: "px" });
          }}
        />
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Letter spacing (px)" variant="stack" state={effectiveRowState(letterSpacing, isAuthored("letterSpacing"))} reset={reset("letterSpacing", "letter spacing")}>
        <InspectorBulkNumberField
          ariaLabel="Letter spacing"
          shared={letterSpacing}
          onCommit={(value) => {
            if (!isValidLetterSpacing(value)) return;
            setElementsTypographyField(ids, "letterSpacing", { value, unit: "px" });
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}
