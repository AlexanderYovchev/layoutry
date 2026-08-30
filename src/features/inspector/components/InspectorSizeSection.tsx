"use client";

import { InspectorAspectRatioFields } from "@/features/inspector/components/InspectorAspectRatioFields";
import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorResizeLockToggle } from "@/features/inspector/components/InspectorResizeLockToggle";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useRenderedNodeSize } from "@/features/editor/hooks/useRenderedNodeSize";
import { getEffectiveAspectRatioLocked } from "@/features/editor/rules/elementCapabilities";
import { getResizeConstraintsForTag } from "@/features/editor/types/layout";
import { getSizeConstraints, isValidSizeConstraintValue, withSizeConstraintField, type SizeConstraints } from "@/features/editor/types/sizeConstraints";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorSizeSectionProps {
  node: EditorElementNode;
  /** Whether this node's own parent is a Free container — decides which underlying geometry Width/Height read/write (freeLayout vs dimensions), and whether Resize Proportions is meaningful at all (see below). */
  isFreeChild: boolean;
}

const SIZE_UNITS = ["px"] as const;

// A rendered size within this many pixels of the preferred size counts as
// "not constrained" — guards against reporting a parent constraint from
// harmless subpixel rounding between the stored value and getBoundingClientRect.
const CONSTRAINT_TOLERANCE_PX = 1;

/**
 * The consolidated "Size" Inspector section (Checkpoint 5.7) — Width/
 * Height/Min/Max/Aspect Ratio/Resize Proportions all in one accordion,
 * expanding the section Checkpoint 5.5 introduced for Aspect Ratio alone
 * rather than adding a second "Dimensions" section next to it. Composes
 * InspectorAspectRatioFields (5.5's own row/custom-fields, now with no
 * section wrapper of its own — see that component's doc comment) and
 * InspectorResizeLockToggle (new) alongside the Width/Height/Min/Max
 * controls this checkpoint adds.
 *
 * Width/Height read/write through two genuinely different underlying
 * representations depending on `isFreeChild` — freeLayout.width/height
 * (via setFreeChildGeometry, the exact action Free's drag handles and
 * InspectorFreeGeometryFields' own X/Y fields already use) for a Free
 * child, or node.dimensions.preferredWidth/preferredHeight (via the new
 * one-shot setElementDimensions action, reusing resizeNode's own
 * tag-based floor clamp) for a Flow node — see this checkpoint's own
 * report for the full ownership audit behind that split. Free's fields
 * never show "Auto" or a Reset control (Free requires concrete geometry
 * by construction); Flow's do.
 *
 * ElementDimensions stays atomic (both axes always set together — see
 * setElementDimensions's own doc comment for the audit behind keeping
 * that architecture, rather than widening it to independently-optional
 * fields). Practically: committing a single Flow axis while the other is
 * still Auto seeds that other axis from the node's own *current rendered
 * size* (useRenderedNodeSize) — the same "start from what's actually on
 * screen, not an invented value" principle a real single-handle resize
 * drag already uses (see computeResizeResult's own doc comment) — and
 * Reset Width/Reset Height are both, honestly, "return to natural Auto
 * sizing on both axes," since a strictly atomic model has no other way
 * to represent "Auto width, explicit height."
 *
 * Resize Proportions (aspectRatioLocked) only renders for a Free child —
 * repository audit (computeFreeChildResizeResult vs. computeResizeResult)
 * confirmed the lock is only ever read by Free-child corner-resize
 * handles; Flow's resize engine has no ratio-lock behavior to expose a
 * control for, so showing one there would promise behavior the engine
 * doesn't implement.
 */
export function InspectorSizeSection({ node, isFreeChild }: InspectorSizeSectionProps) {
  const setElementDimensions = useEditorStore((state) => state.setElementDimensions);
  const setFreeChildGeometry = useEditorStore((state) => state.setFreeChildGeometry);
  const setSizeConstraints = useEditorStore((state) => state.setSizeConstraints);
  const setAspectRatioLocked = useEditorStore((state) => state.setAspectRatioLocked);

  const freeGeometry = isFreeChild ? node.freeLayout : undefined;
  const renderedSize = useRenderedNodeSize(!isFreeChild ? node.id : null);

  const constraints = getSizeConstraints(node);

  function commitConstraint<K extends keyof SizeConstraints>(field: K, next: NumericOrAuto) {
    if (typeof next !== "number") return;
    setSizeConstraints(node.id, withSizeConstraintField(constraints, field, next));
  }

  function resetConstraint(field: keyof SizeConstraints) {
    setSizeConstraints(node.id, withSizeConstraintField(constraints, field, undefined));
  }

  function constraintValue(field: keyof SizeConstraints): number {
    const value = constraints[field];
    return value !== undefined && isValidSizeConstraintValue(value) ? value : 0;
  }

  // --- Flow width/height ---
  function commitFlowWidth(next: NumericOrAuto) {
    if (next === "auto") {
      setElementDimensions(node.id, undefined);
      return;
    }
    const fallback = getResizeConstraintsForTag();
    const height = node.dimensions?.preferredHeight ?? renderedSize?.height ?? fallback.minHeight;
    setElementDimensions(node.id, {
      preferredWidth: next,
      preferredHeight: height,
      offsetX: node.dimensions?.offsetX ?? 0,
      offsetY: node.dimensions?.offsetY ?? 0,
    });
  }

  function commitFlowHeight(next: NumericOrAuto) {
    if (next === "auto") {
      setElementDimensions(node.id, undefined);
      return;
    }
    const fallback = getResizeConstraintsForTag();
    const width = node.dimensions?.preferredWidth ?? renderedSize?.width ?? fallback.minWidth;
    setElementDimensions(node.id, {
      preferredWidth: width,
      preferredHeight: next,
      offsetX: node.dimensions?.offsetX ?? 0,
      offsetY: node.dimensions?.offsetY ?? 0,
    });
  }

  function resetSize() {
    setElementDimensions(node.id, undefined);
  }

  // --- Free width/height ---
  function commitFreeWidth(next: NumericOrAuto) {
    if (typeof next !== "number" || !freeGeometry) return;
    setFreeChildGeometry(node.id, { ...freeGeometry, width: next });
  }

  function commitFreeHeight(next: NumericOrAuto) {
    if (typeof next !== "number" || !freeGeometry) return;
    setFreeChildGeometry(node.id, { ...freeGeometry, height: next });
  }

  // --- Resize Proportions (Free only) ---
  const hasExplicitLock = node.aspectRatioLocked !== undefined;
  const effectiveLocked = getEffectiveAspectRatioLocked(node);

  function toggleLock() {
    setAspectRatioLocked(node.id, !effectiveLocked);
  }

  function resetLock() {
    setAspectRatioLocked(node.id, undefined);
  }

  const widthValue: NumericOrAuto = isFreeChild ? (freeGeometry?.width ?? 0) : (node.dimensions?.preferredWidth ?? "auto");
  const heightValue: NumericOrAuto = isFreeChild ? (freeGeometry?.height ?? 0) : (node.dimensions?.preferredHeight ?? "auto");

  const widthConstrained =
    !isFreeChild &&
    node.dimensions !== undefined &&
    renderedSize !== null &&
    renderedSize.width < node.dimensions.preferredWidth - CONSTRAINT_TOLERANCE_PX;
  const heightConstrained =
    !isFreeChild &&
    node.dimensions !== undefined &&
    renderedSize !== null &&
    renderedSize.height < node.dimensions.preferredHeight - CONSTRAINT_TOLERANCE_PX;

  if (isFreeChild && !freeGeometry) return null;

  return (
    <InspectorSection label="Size" defaultOpen>
      <div className="grid grid-cols-2 gap-2">
        <InspectorPropertyRow
          label="Width"
          variant="stack"
          state={!isFreeChild && node.dimensions === undefined ? "unset" : "set"}
          reset={!isFreeChild && <InspectorResetButton onReset={resetSize} disabled={node.dimensions === undefined} label="Reset width" />}
        >
          <InspectorNumericValueControl
            ariaLabel="Width"
            value={widthValue}
            allowAuto={!isFreeChild}
            min={0}
            unit="px"
            allowedUnits={SIZE_UNITS}
            onCommit={isFreeChild ? commitFreeWidth : commitFlowWidth}
          />
        </InspectorPropertyRow>
        <InspectorPropertyRow
          label="Height"
          variant="stack"
          state={!isFreeChild && node.dimensions === undefined ? "unset" : "set"}
          reset={!isFreeChild && <InspectorResetButton onReset={resetSize} disabled={node.dimensions === undefined} label="Reset height" />}
        >
          <InspectorNumericValueControl
            ariaLabel="Height"
            value={heightValue}
            allowAuto={!isFreeChild}
            min={0}
            unit="px"
            allowedUnits={SIZE_UNITS}
            onCommit={isFreeChild ? commitFreeHeight : commitFlowHeight}
          />
        </InspectorPropertyRow>
      </div>
      {widthConstrained && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          Width renders at {Math.round(renderedSize!.width)}px — constrained by its parent.
        </p>
      )}
      {heightConstrained && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          Height renders at {Math.round(renderedSize!.height)}px — constrained by its parent.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide dark:text-zinc-500">Constraints</span>
        <div className="grid grid-cols-2 gap-2">
          <InspectorPropertyRow
            label="Min W"
            variant="stack"
            state={constraints.minWidth !== undefined ? "set" : "unset"}
            reset={<InspectorResetButton onReset={() => resetConstraint("minWidth")} disabled={constraints.minWidth === undefined} label="Reset min width" />}
          >
            <InspectorNumericValueControl ariaLabel="Min Width" value={constraintValue("minWidth")} min={0} unit="px" allowedUnits={SIZE_UNITS} onCommit={(next) => commitConstraint("minWidth", next)} />
          </InspectorPropertyRow>
          <InspectorPropertyRow
            label="Max W"
            variant="stack"
            state={constraints.maxWidth !== undefined ? "set" : "unset"}
            reset={<InspectorResetButton onReset={() => resetConstraint("maxWidth")} disabled={constraints.maxWidth === undefined} label="Reset max width" />}
          >
            <InspectorNumericValueControl ariaLabel="Max Width" value={constraintValue("maxWidth")} min={0} unit="px" allowedUnits={SIZE_UNITS} onCommit={(next) => commitConstraint("maxWidth", next)} />
          </InspectorPropertyRow>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <InspectorPropertyRow
            label="Min H"
            variant="stack"
            state={constraints.minHeight !== undefined ? "set" : "unset"}
            reset={<InspectorResetButton onReset={() => resetConstraint("minHeight")} disabled={constraints.minHeight === undefined} label="Reset min height" />}
          >
            <InspectorNumericValueControl ariaLabel="Min Height" value={constraintValue("minHeight")} min={0} unit="px" allowedUnits={SIZE_UNITS} onCommit={(next) => commitConstraint("minHeight", next)} />
          </InspectorPropertyRow>
          <InspectorPropertyRow
            label="Max H"
            variant="stack"
            state={constraints.maxHeight !== undefined ? "set" : "unset"}
            reset={<InspectorResetButton onReset={() => resetConstraint("maxHeight")} disabled={constraints.maxHeight === undefined} label="Reset max height" />}
          >
            <InspectorNumericValueControl ariaLabel="Max Height" value={constraintValue("maxHeight")} min={0} unit="px" allowedUnits={SIZE_UNITS} onCommit={(next) => commitConstraint("maxHeight", next)} />
          </InspectorPropertyRow>
        </div>
      </div>

      <InspectorAspectRatioFields node={node} />

      {isFreeChild && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">Lock resize proportions</span>
          <div className="flex items-center gap-1">
            <InspectorResizeLockToggle locked={effectiveLocked} onToggle={toggleLock} />
            <InspectorResetButton onReset={resetLock} disabled={!hasExplicitLock} label="Reset resize proportions" />
          </div>
        </div>
      )}
    </InspectorSection>
  );
}
