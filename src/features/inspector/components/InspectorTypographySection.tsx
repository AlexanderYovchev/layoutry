"use client";

import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import { useState } from "react";
import { InspectorColorFieldShell } from "@/features/inspector/components/InspectorColorFieldShell";
import { InspectorFontFamilyField } from "@/features/inspector/components/InspectorFontFamilyField";
import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useRenderedFontSize } from "@/features/inspector/hooks/useRenderedFontSize";
import {
  getTypographySettings,
  isValidCssColor,
  isValidFontSize,
  isValidLetterSpacing,
  isValidLineHeight,
  withTypographyField,
  type CssUnit,
  type FontStyleValue,
  type FontWeight,
  type TextAlign,
  type TextDecorationLine,
  type TypographySettings,
} from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorTypographySectionProps {
  node: EditorElementNode;
}

/**
 * Matches no real option — used as the segmented-row `activeOption` for an
 * unset Weight/Style/Align so nothing appears falsely highlighted. Every
 * tag's own real default differs (an h1 already renders at font-weight
 * 600 via Tailwind's font-semibold, a paragraph at 400, a button at 500),
 * so highlighting a single hardcoded label like "Regular" for every tag
 * when unset would misrepresent what's actually rendering — see the
 * checkpoint report's browser-verification notes for how this was caught.
 */
const NO_ACTIVE_OPTION = "";

const FONT_SIZE_UNITS: readonly CssUnit[] = ["px", "rem", "em"];
const LINE_HEIGHT_UNITS: readonly CssUnit[] = ["unitless", "px", "%"];
const LETTER_SPACING_UNITS: readonly CssUnit[] = ["px", "em", "rem"];

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
const FONT_WEIGHT_LABELS = FONT_WEIGHT_OPTIONS.map((option) => option.label);
const FONT_WEIGHT_LABEL_TO_VALUE = Object.fromEntries(
  FONT_WEIGHT_OPTIONS.map((option) => [option.label, option.value]),
) as Record<string, FontWeight>;
const FONT_WEIGHT_VALUE_TO_LABEL = Object.fromEntries(
  FONT_WEIGHT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<FontWeight, string>;

const FONT_STYLE_OPTIONS = ["Normal", "Italic", "Oblique"];
const FONT_STYLE_LABEL_TO_VALUE: Record<string, FontStyleValue> = { Normal: "normal", Italic: "italic", Oblique: "oblique" };
const FONT_STYLE_VALUE_TO_LABEL: Record<FontStyleValue, string> = { normal: "Normal", italic: "Italic", oblique: "Oblique" };

const TEXT_DECORATION_OPTIONS = ["None", "Underline", "Overline", "Line Through"];
const TEXT_DECORATION_LABEL_TO_VALUE: Record<string, TextDecorationLine> = {
  None: "none",
  Underline: "underline",
  Overline: "overline",
  "Line Through": "line-through",
};
const TEXT_DECORATION_VALUE_TO_LABEL: Record<TextDecorationLine, string> = {
  none: "None",
  underline: "Underline",
  overline: "Overline",
  "line-through": "Line Through",
};

const TEXT_ALIGN_OPTIONS = ["Left", "Center", "Right", "Justify"];
const TEXT_ALIGN_LABEL_TO_VALUE: Record<string, TextAlign> = { Left: "left", Center: "center", Right: "right", Justify: "justify" };
const TEXT_ALIGN_VALUE_TO_LABEL: Record<TextAlign, string> = { left: "Left", center: "Center", right: "Right", justify: "Justify" };
const TEXT_ALIGN_ICONS = {
  Left: <AlignLeft className="size-3.5" />,
  Center: <AlignCenter className="size-3.5" />,
  Right: <AlignRight className="size-3.5" />,
  Justify: <AlignJustify className="size-3.5" />,
};

/**
 * The Typography Foundation section (Checkpoint 4.2) — the first full CSS
 * property section built on the Checkpoint 4.1/4.1.5 shared primitives.
 * Every field commits through the same setElementTypography store action
 * (one pushHistory per commit, exactly like every other Inspector
 * section), reads its current value via getTypographySettings (which
 * deliberately never synthesizes a default — see types/typography.ts), and
 * resets via withTypographyField, which collapses back to a genuinely
 * absent `typography` once every field has been cleared. Numeric fields
 * that have a real invalid range (font size, line height) validate in
 * their own commit handler here rather than via InspectorNumericValueControl's
 * min/max clamp, specifically so an invalid attempt shows a clear message
 * (this checkpoint's explicit "reject ... provide clear validation"
 * requirement) instead of being silently coerced the way Spacing's
 * negative-value clamp is.
 */
export function InspectorTypographySection({ node }: InspectorTypographySectionProps) {
  const setElementTypography = useEditorStore((state) => state.setElementTypography);
  const typography = getTypographySettings(node);
  // An unset font size shows (and steps from) what the Canvas actually
  // renders — e.g. an H1's 30px heading default — never a guessed 16
  // (BC-01.4). Displayed only; the property stays unset until edited.
  const renderedFontSize = useRenderedFontSize(typography.fontSize ? null : node.id);

  const [fontSizeError, setFontSizeError] = useState<string | undefined>(undefined);
  const [lineHeightError, setLineHeightError] = useState<string | undefined>(undefined);
  const [colorError, setColorError] = useState<string | undefined>(undefined);

  // Re-derives every local validation-error message the moment the
  // *selection* itself changes (not on every typography update) — the
  // same selection-change-reset pattern every other Inspector local-state
  // toggle in this app already uses, so a stale "Enter a valid color"
  // message from a previously-selected node can't linger onto a newly
  // selected one that has no such error.
  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setFontSizeError(undefined);
    setLineHeightError(undefined);
    setColorError(undefined);
  }

  function commitField<K extends keyof TypographySettings>(field: K, value: TypographySettings[K]) {
    setElementTypography(node.id, withTypographyField(typography, field, value));
  }

  function resetField(field: keyof TypographySettings) {
    setElementTypography(node.id, withTypographyField(typography, field, undefined));
  }

  function handleFontSizeCommit(next: NumericOrAuto) {
    if (typeof next !== "number") return;
    if (!isValidFontSize(next)) {
      setFontSizeError("Enter a font size greater than 0.");
      return;
    }
    setFontSizeError(undefined);
    commitField("fontSize", { value: next, unit: typography.fontSize?.unit ?? "px" });
  }

  function handleLineHeightCommit(next: NumericOrAuto) {
    if (typeof next !== "number") return;
    if (!isValidLineHeight(next)) {
      setLineHeightError("Line height can't be negative.");
      return;
    }
    setLineHeightError(undefined);
    commitField("lineHeight", { value: next, unit: typography.lineHeight?.unit ?? "unitless" });
  }

  function handleLetterSpacingCommit(next: NumericOrAuto) {
    if (typeof next !== "number" || !isValidLetterSpacing(next)) return;
    commitField("letterSpacing", { value: next, unit: typography.letterSpacing?.unit ?? "px" });
  }

  function handleColorCommit(text: string) {
    if (!isValidCssColor(text)) {
      setColorError("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
      return;
    }
    setColorError(undefined);
    commitField("color", text);
  }

  return (
    <InspectorSection label="Typography" defaultOpen>
      <InspectorPropertyRow
        label="Font"
        labelHtmlFor="typography-font-family"
        state={typography.fontFamily ? "set" : "unset"}
        reset={<InspectorResetButton onReset={() => resetField("fontFamily")} disabled={!typography.fontFamily} label="Reset font family" />}
      >
        <InspectorFontFamilyField
          ariaLabel="Font"
          value={typography.fontFamily}
          onCommit={(value) => commitField("fontFamily", value)}
        />
      </InspectorPropertyRow>

      <InspectorPropertyRow
        label="Font size"
        variant="stack"
        state={fontSizeError ? "invalid" : typography.fontSize ? "set" : "unset"}
        error={fontSizeError}
        reset={<InspectorResetButton onReset={() => resetField("fontSize")} disabled={!typography.fontSize} label="Reset font size" />}
      >
        <InspectorNumericValueControl
          ariaLabel="Font size"
          value={typography.fontSize?.value ?? renderedFontSize ?? 16}
          unit={typography.fontSize?.unit ?? "px"}
          allowedUnits={FONT_SIZE_UNITS}
          onUnitChange={(unit) => typography.fontSize && commitField("fontSize", { ...typography.fontSize, unit })}
          onCommit={handleFontSizeCommit}
          onEditCancel={() => setFontSizeError(undefined)}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow
        label="Weight"
        state={typography.fontWeight ? "set" : "unset"}
        options={FONT_WEIGHT_LABELS}
        activeOption={typography.fontWeight ? FONT_WEIGHT_VALUE_TO_LABEL[typography.fontWeight] : NO_ACTIVE_OPTION}
        onSelect={(option) => commitField("fontWeight", FONT_WEIGHT_LABEL_TO_VALUE[option])}
        reset={<InspectorResetButton onReset={() => resetField("fontWeight")} disabled={!typography.fontWeight} label="Reset font weight" />}
      />

      <InspectorSegmentedRow
        label="Style"
        state={typography.fontStyle ? "set" : "unset"}
        options={FONT_STYLE_OPTIONS}
        activeOption={typography.fontStyle ? FONT_STYLE_VALUE_TO_LABEL[typography.fontStyle] : NO_ACTIVE_OPTION}
        onSelect={(option) => commitField("fontStyle", FONT_STYLE_LABEL_TO_VALUE[option])}
        reset={<InspectorResetButton onReset={() => resetField("fontStyle")} disabled={!typography.fontStyle} label="Reset font style" />}
      />

      <InspectorSegmentedRow
        label="Decoration"
        state={typography.textDecorationLine ? "set" : "unset"}
        options={TEXT_DECORATION_OPTIONS}
        activeOption={typography.textDecorationLine ? TEXT_DECORATION_VALUE_TO_LABEL[typography.textDecorationLine] : NO_ACTIVE_OPTION}
        onSelect={(option) => commitField("textDecorationLine", TEXT_DECORATION_LABEL_TO_VALUE[option])}
        reset={
          <InspectorResetButton
            onReset={() => resetField("textDecorationLine")}
            disabled={!typography.textDecorationLine}
            label="Reset text decoration"
          />
        }
      />

      <InspectorPropertyRow
        label="Color"
        state={colorError ? "invalid" : typography.color ? "set" : "unset"}
        error={colorError}
      >
        <InspectorColorFieldShell
          label="Text color"
          value={typography.color ?? null}
          onCommit={handleColorCommit}
          onEditCancel={() => setColorError(undefined)}
          onReset={() => {
            setColorError(undefined);
            resetField("color");
          }}
          error={colorError}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow
        label="Align"
        state={typography.textAlign ? "set" : "unset"}
        options={TEXT_ALIGN_OPTIONS}
        optionIcons={TEXT_ALIGN_ICONS}
        activeOption={typography.textAlign ? TEXT_ALIGN_VALUE_TO_LABEL[typography.textAlign] : NO_ACTIVE_OPTION}
        onSelect={(option) => commitField("textAlign", TEXT_ALIGN_LABEL_TO_VALUE[option])}
        reset={<InspectorResetButton onReset={() => resetField("textAlign")} disabled={!typography.textAlign} label="Reset text alignment" />}
      />

      <InspectorPropertyRow
        label="Line height"
        variant="stack"
        help="Controls the spacing between lines of text."
        state={lineHeightError ? "invalid" : typography.lineHeight ? "set" : "unset"}
        error={lineHeightError}
        reset={<InspectorResetButton onReset={() => resetField("lineHeight")} disabled={!typography.lineHeight} label="Reset line height" />}
      >
        <InspectorNumericValueControl
          ariaLabel="Line height"
          value={typography.lineHeight?.value ?? 1.5}
          step={0.1}
          unit={typography.lineHeight?.unit ?? "unitless"}
          allowedUnits={LINE_HEIGHT_UNITS}
          onUnitChange={(unit) => typography.lineHeight && commitField("lineHeight", { ...typography.lineHeight, unit })}
          onCommit={handleLineHeightCommit}
          onEditCancel={() => setLineHeightError(undefined)}
        />
      </InspectorPropertyRow>

      <InspectorPropertyRow
        label="Letter spacing"
        variant="stack"
        help="Adjusts the space between individual letters."
        state={typography.letterSpacing ? "set" : "unset"}
        reset={
          <InspectorResetButton
            onReset={() => resetField("letterSpacing")}
            disabled={!typography.letterSpacing}
            label="Reset letter spacing"
          />
        }
      >
        <InspectorNumericValueControl
          ariaLabel="Letter spacing"
          value={typography.letterSpacing?.value ?? 0}
          unit={typography.letterSpacing?.unit ?? "px"}
          allowedUnits={LETTER_SPACING_UNITS}
          onUnitChange={(unit) => typography.letterSpacing && commitField("letterSpacing", { ...typography.letterSpacing, unit })}
          onCommit={handleLetterSpacingCommit}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}
