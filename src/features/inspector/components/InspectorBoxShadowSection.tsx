"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { InspectorColorFieldShell } from "@/features/inspector/components/InspectorColorFieldShell";
import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorShadowLayerList } from "@/features/inspector/components/InspectorShadowLayerList";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import {
  addShadowLayer,
  applyShadowPreset,
  createDefaultShadowLayer,
  duplicateShadowLayer,
  getBoxShadowLayers,
  isValidShadowBlurValue,
  normalizeBoxShadowSettings,
  removeShadowLayer,
  reorderShadowLayer,
  updateShadowLayer,
  MAX_SHADOW_LAYERS,
  SHADOW_LENGTH_UNITS,
  SHADOW_PRESETS,
  type ShadowLayer,
  type ShadowPreset,
} from "@/features/editor/types/boxShadow";
import type { CssLengthValue, CssUnit } from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBoxShadowSectionProps {
  node: EditorElementNode;
}

type GeometryField = "offsetX" | "offsetY" | "blur" | "spread";

const GEOMETRY_FIELDS: readonly { field: GeometryField; label: string }[] = [
  { field: "offsetX", label: "Offset X" },
  { field: "offsetY", label: "Offset Y" },
  { field: "blur", label: "Blur" },
  { field: "spread", label: "Spread" },
];

/** Explicit switch over literal property names (matching resolveBorderRadiusStyle's applyCornerStyle) — a generic `{ [field]: value }` computed-key patch can't be checked by TypeScript against each field's own value type. */
function geometryPatch(field: GeometryField, value: CssLengthValue | undefined): Partial<Omit<ShadowLayer, "id">> {
  switch (field) {
    case "offsetX":
      return { offsetX: value };
    case "offsetY":
      return { offsetY: value };
    case "blur":
      return { blur: value };
    case "spread":
      return { spread: value };
  }
}

/**
 * The Box Shadow Foundation section (Checkpoint 4.6) — the first
 * Inspector CSS section built around a *list* from day one (see
 * types/boxShadow.ts's own doc comment on why every field below `id`/
 * `enabled`/`inset` is optional, unlike the brief's illustrative model).
 * Structure: an always-visible layer list (InspectorShadowLayerList,
 * skipped entirely only while the list is empty, in favor of a single
 * "Add Shadow" action — Checkpoint 4.6's #4), a Layer Editor for
 * whichever single layer is currently selected, and a Presets row.
 * `selectedLayerId` is purely local Inspector UI state, never written to
 * the document model, self-healing to the list's first layer whenever it
 * doesn't match a real one — the exact same convention
 * InspectorGradientSection's `selectedStopId` already established.
 */
export function InspectorBoxShadowSection({ node }: InspectorBoxShadowSectionProps) {
  const setElementBoxShadow = useEditorStore((state) => state.setElementBoxShadow);
  const setElementBoxShadowLive = useEditorStore((state) => state.setElementBoxShadowLive);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const commitTransaction = useEditorStore((state) => state.commitTransaction);
  const cancelTransaction = useEditorStore((state) => state.cancelTransaction);

  const layers = getBoxShadowLayers(node);

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(() => layers[0]?.id ?? null);
  const [colorError, setColorError] = useState<string | undefined>(undefined);
  const [blurError, setBlurError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setSelectedLayerId(layers[0]?.id ?? null);
    setColorError(undefined);
    setBlurError(undefined);
  }

  const effectiveSelectedLayerId = layers.some((layer) => layer.id === selectedLayerId)
    ? selectedLayerId
    : layers[0]?.id ?? null;
  const selectedLayer = layers.find((layer) => layer.id === effectiveSelectedLayerId) ?? null;

  function commitLayers(next: ShadowLayer[]) {
    setElementBoxShadow(node.id, normalizeBoxShadowSettings(next));
  }

  function liveLayers(next: ShadowLayer[]) {
    setElementBoxShadowLive(node.id, normalizeBoxShadowSettings(next));
  }

  function handleAddLayer() {
    const layer = createDefaultShadowLayer();
    commitLayers(addShadowLayer(layers, layer));
    setSelectedLayerId(layer.id);
    setColorError(undefined);
    setBlurError(undefined);
  }

  function handleToggleEnabled(id: string, enabled: boolean) {
    commitLayers(updateShadowLayer(layers, id, { enabled }));
  }

  function handleInsetChange(inset: boolean) {
    if (!effectiveSelectedLayerId) return;
    commitLayers(updateShadowLayer(layers, effectiveSelectedLayerId, { inset }));
  }

  function handleDuplicateLayer(id: string) {
    const index = layers.findIndex((layer) => layer.id === id);
    const next = duplicateShadowLayer(layers, id);
    if (next === layers) return;
    commitLayers(next);
    const clone = next[index + 1];
    if (clone) setSelectedLayerId(clone.id);
    setColorError(undefined);
    setBlurError(undefined);
  }

  function handleDeleteLayer(id: string) {
    const removedIndex = layers.findIndex((layer) => layer.id === id);
    const next = removeShadowLayer(layers, id);
    if (next === layers) return;
    commitLayers(next);
    if (id === effectiveSelectedLayerId) {
      const nextSelected = next[Math.min(removedIndex, next.length - 1)];
      setSelectedLayerId(nextSelected?.id ?? null);
    }
    setColorError(undefined);
    setBlurError(undefined);
  }

  function handleMoveLayer(id: string, toIndex: number) {
    commitLayers(reorderShadowLayer(layers, id, toIndex));
  }

  function handleDragMove(id: string, toIndex: number) {
    liveLayers(reorderShadowLayer(layers, id, toIndex));
  }

  function handleDragEnd(moved: boolean) {
    if (moved) commitTransaction();
    else cancelTransaction();
  }

  function handleColorCommit(text: string) {
    if (!isValidCssColor(text)) {
      setColorError("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
      return;
    }
    setColorError(undefined);
    if (!effectiveSelectedLayerId) return;
    commitLayers(updateShadowLayer(layers, effectiveSelectedLayerId, { color: text }));
  }

  function handleResetColor() {
    setColorError(undefined);
    if (!effectiveSelectedLayerId) return;
    commitLayers(updateShadowLayer(layers, effectiveSelectedLayerId, { color: undefined }));
  }

  function handleGeometryCommit(field: GeometryField, next: NumericOrAuto) {
    if (typeof next !== "number") return;
    if (field === "blur" && !isValidShadowBlurValue(next)) {
      setBlurError("Blur can't be negative.");
      return;
    }
    if (field === "blur") setBlurError(undefined);
    if (!effectiveSelectedLayerId || !selectedLayer) return;
    const unit = selectedLayer[field]?.unit ?? "px";
    commitLayers(updateShadowLayer(layers, effectiveSelectedLayerId, geometryPatch(field, { value: next, unit })));
  }

  function handleGeometryReset(field: GeometryField) {
    if (!effectiveSelectedLayerId) return;
    commitLayers(updateShadowLayer(layers, effectiveSelectedLayerId, geometryPatch(field, undefined)));
  }

  function handleUnitChange(field: GeometryField, unit: CssUnit) {
    if (!effectiveSelectedLayerId || !selectedLayer) return;
    const current = selectedLayer[field] ?? { value: 0, unit: "px" as CssUnit };
    commitLayers(updateShadowLayer(layers, effectiveSelectedLayerId, geometryPatch(field, { ...current, unit })));
  }

  function handleResetGeometry() {
    if (!effectiveSelectedLayerId) return;
    commitLayers(
      updateShadowLayer(layers, effectiveSelectedLayerId, {
        offsetX: undefined,
        offsetY: undefined,
        blur: undefined,
        spread: undefined,
      }),
    );
    setBlurError(undefined);
  }

  function handleResetSelectedLayer() {
    if (!effectiveSelectedLayerId) return;
    commitLayers(
      updateShadowLayer(layers, effectiveSelectedLayerId, {
        offsetX: undefined,
        offsetY: undefined,
        blur: undefined,
        spread: undefined,
        color: undefined,
      }),
    );
    setColorError(undefined);
    setBlurError(undefined);
  }

  function handlePresetSelect(preset: ShadowPreset) {
    const next = applyShadowPreset(preset);
    setElementBoxShadow(node.id, next);
    setSelectedLayerId(next[0]?.id ?? null);
    setColorError(undefined);
    setBlurError(undefined);
  }

  function handleResetShadow() {
    setElementBoxShadow(node.id, undefined);
    setSelectedLayerId(null);
    setColorError(undefined);
    setBlurError(undefined);
  }

  const hasGeometry = Boolean(
    selectedLayer && (selectedLayer.offsetX || selectedLayer.offsetY || selectedLayer.blur || selectedLayer.spread),
  );

  return (
    <InspectorSection label="Box Shadow" defaultOpen>
      {layers.length === 0 ? (
        <button
          type="button"
          onClick={handleAddLayer}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 text-xs text-zinc-500 transition-colors duration-150 hover:border-zinc-400 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Add Shadow
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Layers ({layers.length})</span>
            <button
              type="button"
              onClick={handleAddLayer}
              disabled={layers.length >= MAX_SHADOW_LAYERS}
              aria-label="Add shadow layer"
              title="Add shadow layer"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <Plus aria-hidden="true" className="size-3.5" />
            </button>
          </div>

          <InspectorShadowLayerList
            layers={layers}
            selectedLayerId={effectiveSelectedLayerId}
            onSelect={setSelectedLayerId}
            onToggleEnabled={handleToggleEnabled}
            onDuplicate={handleDuplicateLayer}
            onDelete={handleDeleteLayer}
            onMove={handleMoveLayer}
            onDragStart={beginTransaction}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          />

          {selectedLayer && (
            <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <InspectorPropertyRow
                label="Color"
                state={colorError ? "invalid" : selectedLayer.color ? "set" : "unset"}
                error={colorError}
                reset={
                  <InspectorResetButton onReset={handleResetColor} disabled={!selectedLayer.color} label="Reset color" />
                }
              >
                <InspectorColorFieldShell
                  label="Shadow color"
                  value={selectedLayer.color ?? null}
                  onCommit={handleColorCommit}
                  error={colorError}
                />
              </InspectorPropertyRow>

              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">Geometry</span>
                <InspectorResetButton onReset={handleResetGeometry} disabled={!hasGeometry} label="Reset geometry" />
              </div>

              {GEOMETRY_FIELDS.map(({ field, label }) => {
                const fieldValue = selectedLayer[field];
                return (
                  <InspectorPropertyRow
                    key={field}
                    label={label}
                    variant="stack"
                    state={field === "blur" && blurError ? "invalid" : fieldValue ? "set" : "unset"}
                    error={field === "blur" ? blurError : undefined}
                    reset={
                      <InspectorResetButton
                        onReset={() => handleGeometryReset(field)}
                        disabled={!fieldValue}
                        label={`Reset ${label.toLowerCase()}`}
                      />
                    }
                  >
                    <InspectorNumericValueControl
                      ariaLabel={label}
                      value={fieldValue?.value ?? 0}
                      unit={fieldValue?.unit ?? "px"}
                      allowedUnits={SHADOW_LENGTH_UNITS}
                      onUnitChange={(unit) => handleUnitChange(field, unit)}
                      onCommit={(next) => handleGeometryCommit(field, next)}
                    />
                  </InspectorPropertyRow>
                );
              })}

              <InspectorPropertyRow label="Inset">
                <InspectorBooleanToggle checked={selectedLayer.inset} onChange={handleInsetChange} label="Inset shadow" />
              </InspectorPropertyRow>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleResetSelectedLayer}
                  className="text-[11px] hover:text-zinc-600 hover:underline dark:hover:text-zinc-300 text-fg-secondary"
                >
                  Reset Selected Layer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-fg-secondary">Presets</span>
          <InspectorResetButton onReset={handleResetShadow} disabled={layers.length === 0} label="Reset shadow" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SHADOW_PRESETS.map(({ preset, label }) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetSelect(preset)}
              aria-label={`${label} shadow preset`}
              title={`${label} shadow preset`}
              className="flex h-7 items-center justify-center rounded-full border border-line bg-surface-panel px-2.5 font-medium text-fg-secondary transition-colors duration-150 ease-studio hover:border-line-strong hover:bg-surface-hover hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent active:bg-surface-selected"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </InspectorSection>
  );
}
