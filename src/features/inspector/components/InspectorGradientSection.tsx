"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { InspectorBackgroundPositionGrid } from "@/features/inspector/components/InspectorBackgroundPositionGrid";
import { InspectorColorFieldShell } from "@/features/inspector/components/InspectorColorFieldShell";
import { InspectorGradientStopTrack } from "@/features/inspector/components/InspectorGradientStopTrack";
import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import {
  getBackgroundSettings,
  withBackgroundGradientReset,
  withBackgroundGradientSource,
  type BackgroundPosition,
} from "@/features/editor/types/background";
import {
  addGradientStop,
  computeNewStopPosition,
  formatGradientCss,
  generateGradientStopId,
  isValidGradientStopPosition,
  MAX_GRADIENT_STOPS,
  MIN_GRADIENT_STOPS,
  nearestStopColor,
  normalizeGradientAngle,
  removeGradientStop,
  updateGradientStop,
  withGradientType,
  type GradientSettings,
  type GradientType,
  type RadialGradientShape,
} from "@/features/editor/types/gradient";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorGradientSectionProps {
  node: EditorElementNode;
}

const TYPE_OPTIONS = ["Linear", "Radial"];
const SHAPE_OPTIONS = ["Ellipse", "Circle"];

/**
 * The Gradient source's controls (Checkpoint 4.3.1) — rendered only while
 * Gradient is the Background section's selected source (see
 * InspectorBackgroundSection, this component's sibling
 * InspectorBackgroundImageControls). Built entirely on existing shared
 * primitives plus one new control genuinely specific to this property
 * (InspectorGradientStopTrack). Every commit goes through the same
 * setElementBackground action every other Background field already uses
 * (via withBackgroundGradientSource, which keeps `sourceType` and
 * `gradient` written together in one call — see background.ts) — no
 * second Background command system, per this checkpoint's own explicit
 * instruction.
 *
 * Selected-stop identity is local Inspector state, never document
 * content (Checkpoint 4.3.1's #17) — `effectiveSelectedStopId` below
 * self-heals to the gradient's first stop whenever the stored
 * `selectedStopId` doesn't (or no longer) matches any real stop, which
 * covers every case that could otherwise leave a dangling selection:
 * Undo/Redo, switching Linear/Radial, removing the selected stop, or
 * switching away to Image and back.
 */
export function InspectorGradientSection({ node }: InspectorGradientSectionProps) {
  const setElementBackground = useEditorStore((state) => state.setElementBackground);
  const setElementBackgroundLive = useEditorStore((state) => state.setElementBackgroundLive);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const commitTransaction = useEditorStore((state) => state.commitTransaction);
  const cancelTransaction = useEditorStore((state) => state.cancelTransaction);

  const background = getBackgroundSettings(node);
  const gradient = background.gradient;

  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [colorError, setColorError] = useState<string | undefined>(undefined);
  const [positionError, setPositionError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setSelectedStopId(null);
    setColorError(undefined);
    setPositionError(undefined);
  }

  // Gradient is only absent here for a structurally-invalid moment (this
  // section is only ever rendered once Gradient is the active source,
  // which always writes `gradient` in the same commit — see
  // withBackgroundGradientSource) — defensive, not an expected path.
  if (!gradient) return null;

  const effectiveSelectedStopId = gradient.stops.some((stop) => stop.id === selectedStopId)
    ? selectedStopId
    : gradient.stops[0]?.id ?? null;
  const selectedStop = gradient.stops.find((stop) => stop.id === effectiveSelectedStopId) ?? null;

  function commitGradient(next: GradientSettings) {
    setElementBackground(node.id, withBackgroundGradientSource(background, next));
  }

  function liveGradient(next: GradientSettings) {
    setElementBackgroundLive(node.id, withBackgroundGradientSource(background, next));
  }

  function handleTypeSelect(option: string) {
    if (!gradient) return;
    const type: GradientType = option === "Linear" ? "linear" : "radial";
    commitGradient(withGradientType(gradient, type));
  }

  function handleShapeSelect(option: string) {
    if (!gradient || gradient.type !== "radial") return;
    const shape: RadialGradientShape = option === "Circle" ? "circle" : "ellipse";
    commitGradient({ ...gradient, shape });
  }

  function handlePositionSelect(position: BackgroundPosition) {
    if (!gradient || gradient.type !== "radial") return;
    commitGradient({ ...gradient, position });
  }

  function handleAngleCommit(next: NumericOrAuto) {
    if (!gradient || gradient.type !== "linear" || typeof next !== "number") return;
    commitGradient({ ...gradient, angle: normalizeGradientAngle(next) });
  }

  function handleStopColorCommit(text: string) {
    if (!isValidCssColor(text)) {
      setColorError("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
      return;
    }
    setColorError(undefined);
    if (!gradient || !effectiveSelectedStopId) return;
    commitGradient(updateGradientStop(gradient, effectiveSelectedStopId, { color: text }));
  }

  function handleStopPositionCommit(next: NumericOrAuto) {
    if (typeof next !== "number") return;
    if (!isValidGradientStopPosition(next)) {
      setPositionError("Enter a position between 0 and 100.");
      return;
    }
    setPositionError(undefined);
    if (!gradient || !effectiveSelectedStopId) return;
    commitGradient(updateGradientStop(gradient, effectiveSelectedStopId, { position: next }));
  }

  function handleAdjustStopPosition(stopId: string, nextPosition: number) {
    if (!gradient) return;
    commitGradient(updateGradientStop(gradient, stopId, { position: nextPosition }));
  }

  function handleDragMove(stopId: string, position: number) {
    if (!gradient) return;
    liveGradient(updateGradientStop(gradient, stopId, { position }));
  }

  function handleDragEnd(moved: boolean) {
    if (moved) commitTransaction();
    else cancelTransaction();
  }

  function handleAddStop() {
    if (!gradient || gradient.stops.length >= MAX_GRADIENT_STOPS) return;
    const position = computeNewStopPosition(gradient.stops);
    const color = nearestStopColor(gradient.stops, position);
    const newStop = { id: generateGradientStopId(), color, position };
    commitGradient(addGradientStop(gradient, newStop));
    setSelectedStopId(newStop.id);
    setColorError(undefined);
    setPositionError(undefined);
  }

  function handleRemoveSelectedStop() {
    if (!gradient || !effectiveSelectedStopId || gradient.stops.length <= MIN_GRADIENT_STOPS) return;
    const removedIndex = gradient.stops.findIndex((stop) => stop.id === effectiveSelectedStopId);
    const next = removeGradientStop(gradient, effectiveSelectedStopId);
    if (next === gradient) return;
    commitGradient(next);
    const nextSelected = next.stops[Math.min(removedIndex, next.stops.length - 1)];
    setSelectedStopId(nextSelected?.id ?? null);
    setColorError(undefined);
    setPositionError(undefined);
  }

  function handleResetGradient() {
    setElementBackground(node.id, withBackgroundGradientReset(background));
    setSelectedStopId(null);
  }

  const previewCss = formatGradientCss(gradient);

  return (
    <div className="flex flex-col gap-1.5">
      <InspectorSegmentedRow
        label="Type"
        options={TYPE_OPTIONS}
        activeOption={gradient.type === "linear" ? "Linear" : "Radial"}
        onSelect={handleTypeSelect}
        reset={<InspectorResetButton onReset={handleResetGradient} label="Reset gradient" />}
      />

      <div className="relative h-10 w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(45deg,#d4d4d8_25%,transparent_25%),linear-gradient(-45deg,#d4d4d8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d4d4d8_75%),linear-gradient(-45deg,transparent_75%,#d4d4d8_75%)] bg-[length:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0]"
        />
        {previewCss ? (
          <span aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: previewCss }} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] text-fg-secondary">
            No gradient
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">Stops ({gradient.stops.length})</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRemoveSelectedStop}
            disabled={!effectiveSelectedStopId || gradient.stops.length <= MIN_GRADIENT_STOPS}
            aria-label="Remove selected stop"
            title="Remove selected stop"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleAddStop}
            disabled={gradient.stops.length >= MAX_GRADIENT_STOPS}
            aria-label="Add stop"
            title="Add stop"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <Plus aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      </div>

      <InspectorGradientStopTrack
        stops={gradient.stops}
        selectedStopId={effectiveSelectedStopId}
        onSelectStop={setSelectedStopId}
        onDragStart={beginTransaction}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onAdjustPosition={handleAdjustStopPosition}
      />

      {selectedStop && (
        <>
          <InspectorPropertyRow label="Stop color" state={colorError ? "invalid" : "set"} error={colorError}>
            <InspectorColorFieldShell
              label="Gradient stop color"
              value={selectedStop.color}
              onCommit={handleStopColorCommit}
              error={colorError}
            />
          </InspectorPropertyRow>

          <InspectorPropertyRow label="Stop position" variant="stack" state={positionError ? "invalid" : "set"} error={positionError}>
            <InspectorNumericValueControl
              ariaLabel="Stop position"
              value={selectedStop.position}
              unit="%"
              allowedUnits={["%"]}
              onCommit={handleStopPositionCommit}
            />
          </InspectorPropertyRow>
        </>
      )}

      {gradient.type === "linear" ? (
        <InspectorPropertyRow label="Angle" variant="stack" help="0° points up, 90° right, 180° down, 270° left.">
          <InspectorNumericValueControl ariaLabel="Angle" value={gradient.angle} unit="deg" allowedUnits={["deg"]} onCommit={handleAngleCommit} />
        </InspectorPropertyRow>
      ) : (
        <>
          <InspectorSegmentedRow
            label="Shape"
            options={SHAPE_OPTIONS}
            activeOption={gradient.shape === "circle" ? "Circle" : "Ellipse"}
            onSelect={handleShapeSelect}
          />
          <InspectorBackgroundPositionGrid value={gradient.position} onSelect={handlePositionSelect} />
        </>
      )}
    </div>
  );
}
