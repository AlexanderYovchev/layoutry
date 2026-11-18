"use client";

import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorBulkTextField } from "@/features/inspector/components/InspectorBulkTextField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { InspectorSharedValueNote } from "@/features/inspector/components/InspectorSharedValueNote";
import { useRenderedStyles } from "@/features/inspector/hooks/useRenderedStyles";
import {
  absoluteAuthoredColor,
  colorFieldValue,
  commonAuthored,
  effectiveRowState,
  normalizeCssColor,
  normalizeCssPx,
  pxFieldValue,
  resolveSharedEffective,
  type MeasuredStyles,
} from "@/features/inspector/utils/effectiveCss";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  getBorderSettings,
  getBorderSide,
  isValidBorderStyleValue,
  isValidBorderWidthValue,
  type BorderSettings,
  type BorderStyleValue,
} from "@/features/editor/types/border";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkBorderSectionProps {
  nodes: readonly EditorElementNode[];
}

const NO_ACTIVE_OPTION = "";
const STYLE_OPTIONS: BorderStyleValue[] = ["solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"];
const STYLE_LABELS = STYLE_OPTIONS.map((value) => value[0].toUpperCase() + value.slice(1));
const STYLE_LABEL_TO_VALUE = Object.fromEntries(STYLE_OPTIONS.map((value, index) => [STYLE_LABELS[index], value])) as Record<string, BorderStyleValue>;
const STYLE_VALUE_TO_LABEL = Object.fromEntries(STYLE_OPTIONS.map((value, index) => [value, STYLE_LABELS[index]])) as Record<BorderStyleValue, string>;

const SIDES = ["top", "right", "bottom", "left"] as const;
const BORDER_MEASURED = SIDES.flatMap((side) => [`border-${side}-width`, `border-${side}-style`, `border-${side}-color`]);

interface EffectiveBorder {
  width: string;
  style: string;
  color: string;
}

/**
 * One element's effective border as three comparable values (width,
 * style, colour), each the same on all four sides or a "sides:" token
 * (BC-10.3). A side whose effective width is 0 renders nothing, whatever
 * its style or colour (the base stylesheet gives every element a 0-width
 * solid border), so it counts as style "none" and colour "none": two
 * borderless elements agree. Read from the rendered element when
 * possible; otherwise from authored data, where a side with no style,
 * "none" or no width is borderless, and a visible side without an
 * authored colour (currentColor) or with a non-px width is unknown.
 * Undefined when unknown.
 */
function effectiveBorder(nodeId: string, border: BorderSettings, measured: MeasuredStyles | null): EffectiveBorder | undefined {
  const row = measured?.get(nodeId);
  const perSide = SIDES.map((side): EffectiveBorder | undefined => {
    if (row) {
      const width = normalizeCssPx(row[`border-${side}-width`] ?? "");
      if (width === undefined) return undefined;
      if (width === "0px") return { width, style: "none", color: "none" };
      const colorText = (row[`border-${side}-color`] ?? "").trim();
      return { width, style: (row[`border-${side}-style`] ?? "").trim().toLowerCase(), color: normalizeCssColor(colorText) ?? colorText.toLowerCase() };
    }
    const authored = getBorderSide(border, side);
    const visible = authored.style !== undefined && authored.style !== "none" && (authored.width?.value ?? 0) > 0;
    if (!visible) return { width: "0px", style: "none", color: "none" };
    if (authored.width?.unit !== "px") return undefined;
    const color = absoluteAuthoredColor(authored.color);
    if (color === undefined) return undefined;
    return { width: `${authored.width.value}px`, style: authored.style ?? "", color: normalizeCssColor(color) ?? color.toLowerCase() };
  });
  const known = perSide.filter((side): side is EffectiveBorder => side !== undefined);
  if (known.length !== SIDES.length) return undefined;
  const fold = (key: keyof EffectiveBorder) => {
    const values = known.map((side) => side[key]);
    return values.every((value) => value === values[0]) ? values[0] : `sides:${values.join("|")}`;
  };
  return { width: fold("width"), style: fold("style"), color: fold("color") };
}

/**
 * The multi-selection Border surface (Checkpoint 1.15.2) — "All Sides"
 * mode only (writes the same width/style/color to top/right/bottom/left
 * on every targeted node in one commit); per-individual-side bulk editing
 * is deferred (see this checkpoint's report, section J). Each field's own
 * "same vs. mixed" read uses each node's own top side as representative
 * — since BC-10.3 every side is compared by its effective (rendered)
 * value, and a node whose sides differ reads "Varies by side".
 */
export function InspectorBulkBorderSection({ nodes }: InspectorBulkBorderSectionProps) {
  const setElementsBorderAllSidesField = useEditorStore((state) => state.setElementsBorderAllSidesField);
  const ids = nodes.map((node) => node.id);

  // BC-10.3: every side of every element, as rendered (see effectiveBorder).
  const measured = useRenderedStyles(ids, BORDER_MEASURED);
  const borders = nodes.map((node) => effectiveBorder(node.id, getBorderSettings(node), measured));
  const width = resolveSharedEffective(borders.map((border) => border?.width), pxFieldValue);
  const style = resolveSharedEffective(borders.map((border) => border?.style), (normalized) => STYLE_OPTIONS.find((option) => option === normalized));
  const authoredColors = nodes.map((node) => absoluteAuthoredColor(getBorderSide(getBorderSettings(node), "top").color));
  const color = resolveSharedEffective(borders.map((border) => border?.color), (normalized) =>
    normalized === "none" ? "" : (commonAuthored(authoredColors) ?? colorFieldValue(normalized)),
  );
  const sides = nodes.map((node) => SIDES.map((side) => getBorderSide(getBorderSettings(node), side)));
  const authored = {
    width: sides.some((list) => list.some((side) => side.width !== undefined)),
    style: sides.some((list) => list.some((side) => side.style !== undefined)),
    color: sides.some((list) => list.some((side) => side.color !== undefined)),
  };

  return (
    <InspectorSection label="Border">
      <InspectorPropertyRow label="Width" variant="stack" state={effectiveRowState(width, authored.width)} reset={<InspectorResetButton onReset={() => setElementsBorderAllSidesField(ids, "width", undefined)} disabled={!(authored.width)} label="Reset border width on all selected elements" />}>
        <InspectorBulkNumberField
          ariaLabel="Border width"
          shared={width}
          min={0}
          onCommit={(value) => {
            if (!isValidBorderWidthValue(value)) return;
            setElementsBorderAllSidesField(ids, "width", { value, unit: "px" });
          }}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow
        label="Style"
        state={effectiveRowState(style, authored.style)}
        reset={<InspectorResetButton onReset={() => setElementsBorderAllSidesField(ids, "style", undefined)} disabled={!(authored.style)} label="Reset border style on all selected elements" />}
        options={STYLE_LABELS}
        activeOption={style.kind === "same" ? STYLE_VALUE_TO_LABEL[style.value] : NO_ACTIVE_OPTION}
        onSelect={(option) => {
          const value = STYLE_LABEL_TO_VALUE[option];
          if (!isValidBorderStyleValue(value)) return;
          setElementsBorderAllSidesField(ids, "style", value);
        }}
      />

      <InspectorSharedValueNote shared={style} />

      <InspectorPropertyRow label="Color" state={effectiveRowState(color, authored.color)} reset={<InspectorResetButton onReset={() => setElementsBorderAllSidesField(ids, "color", undefined)} disabled={!(authored.color)} label="Reset border color on all selected elements" />}>
        <InspectorBulkTextField
          ariaLabel="Border color"
          shared={color}
          placeholder="#000000"
          onCommit={(value) => {
            if (!isValidCssColor(value)) return;
            setElementsBorderAllSidesField(ids, "color", value);
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}
