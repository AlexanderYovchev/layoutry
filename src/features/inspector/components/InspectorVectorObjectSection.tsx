"use client";

import { useState } from "react";
import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorBulkTextField } from "@/features/inspector/components/InspectorBulkTextField";
import { InspectorColorFieldShell } from "@/features/inspector/components/InspectorColorFieldShell";
import { InspectorFieldRow } from "@/features/inspector/components/InspectorFieldRow";
import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorProtectedStyleGroup } from "@/features/inspector/components/InspectorProtectedStyleGroup";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { resolveSharedValue, withSharedFallback } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import { findSvgObjectById, resolveSvgScene } from "@/features/editor/types/svgScene";
import { getSvgObjectBounds } from "@/features/editor/utils/svgObjectGeometry";
import type { StyleProtectionResult } from "@/features/editor/rules/styleProtection";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { SvgVectorObject } from "@/features/editor/types/svgScene";

interface InspectorVectorObjectSectionProps {
  svgNode: EditorElementNode;
  objectIds: readonly string[];
  protection: StyleProtectionResult;
}

const TYPE_LABEL: Record<SvgVectorObject["type"], string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  polygon: "Polygon",
  path: "Path",
};

/**
 * The contextual "Vector Object" Inspector surface (Checkpoint 1.15.6,
 * section K of its own brief) — appears only while its owning SVG is in
 * Drawing Mode AND one or more vector objects are selected (see
 * InspectorNodeSummary's own routing). Fill/Stroke/Stroke Width are real
 * SVG presentation attributes, guarded by the OWNING SVG's own Parent
 * Style Protection exactly like svgFill/svgStroke/svgStrokeWidth already
 * are (section L — content vs. style, not a new lock); geometry fields
 * are vector CONTENT and stay outside any protected group.
 *
 * A stale selection (an object undone/deleted out from under it) never
 * crashes — missing ids are filtered out before anything renders, and an
 * empty result renders nothing at all rather than a broken section.
 *
 * Deliberately never exposes Polygon/Path's own raw points/`d` (section
 * K's own explicit exclusion) — those two types get Type + styling only,
 * no geometry fields, consistent with "full vertex editing is not
 * required yet" (section 32).
 */
export function InspectorVectorObjectSection({ svgNode, objectIds, protection }: InspectorVectorObjectSectionProps) {
  const setSvgObjectsFill = useEditorStore((state) => state.setSvgObjectsFill);
  const setSvgObjectsStroke = useEditorStore((state) => state.setSvgObjectsStroke);
  const setSvgObjectsStrokeWidth = useEditorStore((state) => state.setSvgObjectsStrokeWidth);
  const resizeSvgObject = useEditorStore((state) => state.resizeSvgObject);
  const setSvgLineStart = useEditorStore((state) => state.setSvgLineStart);
  const setSvgLineEndpoint = useEditorStore((state) => state.setSvgLineEndpoint);

  const [fillError, setFillError] = useState<string | undefined>(undefined);
  const [strokeError, setStrokeError] = useState<string | undefined>(undefined);

  const scene = resolveSvgScene(svgNode);
  const objects = objectIds.map((id) => findSvgObjectById(scene, id)).filter((object): object is SvgVectorObject => object !== undefined);

  const [lastKey, setLastKey] = useState(objects.map((object) => object.id).join(","));
  const key = objects.map((object) => object.id).join(",");
  if (key !== lastKey) {
    setLastKey(key);
    setFillError(undefined);
    setStrokeError(undefined);
  }

  if (objects.length === 0) return null;

  const ids = objects.map((object) => object.id);

  function commitFill(text: string) {
    if (!isValidCssColor(text)) {
      setFillError("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
      return;
    }
    setFillError(undefined);
    setSvgObjectsFill(svgNode.id, ids, text);
  }

  function commitStroke(text: string) {
    if (!isValidCssColor(text)) {
      setStrokeError("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
      return;
    }
    setStrokeError(undefined);
    setSvgObjectsStroke(svgNode.id, ids, text);
  }

  if (objects.length === 1) {
    const object = objects[0];
    const bounds = getSvgObjectBounds(object);

    function commitBounds(patch: Partial<ReturnType<typeof getSvgObjectBounds>>) {
      resizeSvgObject(svgNode.id, object.id, { ...bounds, ...patch });
    }

    return (
      <InspectorSection label="Vector Object" defaultOpen>
        <InspectorFieldRow label="Type" value={TYPE_LABEL[object.type]} />

        <InspectorProtectedStyleGroup protected={protection.protected}>
          <div className="flex flex-col gap-2">
            <InspectorPropertyRow label="Fill" state={fillError ? "invalid" : object.fill ? "set" : "unset"} error={fillError}>
              <InspectorColorFieldShell label="Fill" value={object.fill ?? null} onCommit={commitFill} onReset={() => setSvgObjectsFill(svgNode.id, ids, undefined)} error={fillError} />
            </InspectorPropertyRow>
            <InspectorPropertyRow label="Stroke" state={strokeError ? "invalid" : object.stroke ? "set" : "unset"} error={strokeError}>
              <InspectorColorFieldShell
                label="Stroke"
                value={object.stroke ?? null}
                onCommit={commitStroke}
                onReset={() => setSvgObjectsStroke(svgNode.id, ids, undefined)}
                error={strokeError}
              />
            </InspectorPropertyRow>
            <InspectorNumberFieldRow
              label="Stroke Width"
              value={object.strokeWidth ?? 1}
              onCommit={(value) => setSvgObjectsStrokeWidth(svgNode.id, ids, Math.max(0, value))}
            />
          </div>
        </InspectorProtectedStyleGroup>

        {object.type === "rect" && (
          <InspectorPropertyRow label="Geometry" variant="stack">
            <div className="grid grid-cols-2 gap-1.5">
              <InspectorNumberFieldRow label="X" value={object.x} onCommit={(x) => commitBounds({ x })} />
              <InspectorNumberFieldRow label="Y" value={object.y} onCommit={(y) => commitBounds({ y })} />
              <InspectorNumberFieldRow label="Width" value={object.width} onCommit={(width) => commitBounds({ width: Math.max(1, width) })} />
              <InspectorNumberFieldRow label="Height" value={object.height} onCommit={(height) => commitBounds({ height: Math.max(1, height) })} />
            </div>
          </InspectorPropertyRow>
        )}

        {object.type === "ellipse" && (
          <InspectorPropertyRow label="Geometry" variant="stack">
            <div className="grid grid-cols-2 gap-1.5">
              <InspectorNumberFieldRow label="CX" value={object.cx} onCommit={(cx) => commitBounds({ x: cx - bounds.width / 2 })} />
              <InspectorNumberFieldRow label="CY" value={object.cy} onCommit={(cy) => commitBounds({ y: cy - bounds.height / 2 })} />
              <InspectorNumberFieldRow label="RX" value={object.rx} onCommit={(rx) => commitBounds({ width: Math.max(1, rx * 2) })} />
              <InspectorNumberFieldRow label="RY" value={object.ry} onCommit={(ry) => commitBounds({ height: Math.max(1, ry * 2) })} />
            </div>
          </InspectorPropertyRow>
        )}

        {object.type === "line" && (
          <InspectorPropertyRow label="Geometry" variant="stack">
            <div className="grid grid-cols-2 gap-1.5">
              <InspectorNumberFieldRow label="X1" value={object.x1} onCommit={(x1) => setSvgLineStart(svgNode.id, object.id, x1, object.y1)} />
              <InspectorNumberFieldRow label="Y1" value={object.y1} onCommit={(y1) => setSvgLineStart(svgNode.id, object.id, object.x1, y1)} />
              <InspectorNumberFieldRow label="X2" value={object.x2} onCommit={(x2) => setSvgLineEndpoint(svgNode.id, object.id, x2, object.y2)} />
              <InspectorNumberFieldRow label="Y2" value={object.y2} onCommit={(y2) => setSvgLineEndpoint(svgNode.id, object.id, object.x2, y2)} />
            </div>
          </InspectorPropertyRow>
        )}
      </InspectorSection>
    );
  }

  const fill = resolveSharedValue(objects, (object) => object.fill);
  const stroke = resolveSharedValue(objects, (object) => object.stroke);
  const strokeWidth = resolveSharedValue(objects, (object) => object.strokeWidth);

  return (
    <InspectorSection label="Vector Objects" defaultOpen>
      <p className="px-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{objects.length} objects selected</p>
      <InspectorProtectedStyleGroup protected={protection.protected}>
        <div className="flex flex-col gap-2">
          <InspectorPropertyRow label="Fill" state={fill.kind === "mixed" ? "mixed" : fill.value ? "set" : "unset"}>
            <InspectorBulkTextField
              ariaLabel="Fill"
              shared={withSharedFallback(fill, "")}
              placeholder="Unset"
              onCommit={(value) => {
                if (!isValidCssColor(value)) return;
                setSvgObjectsFill(svgNode.id, ids, value);
              }}
            />
          </InspectorPropertyRow>
          <InspectorPropertyRow label="Stroke" state={stroke.kind === "mixed" ? "mixed" : stroke.value ? "set" : "unset"}>
            <InspectorBulkTextField
              ariaLabel="Stroke"
              shared={withSharedFallback(stroke, "")}
              placeholder="Unset"
              onCommit={(value) => {
                if (!isValidCssColor(value)) return;
                setSvgObjectsStroke(svgNode.id, ids, value);
              }}
            />
          </InspectorPropertyRow>
          <InspectorPropertyRow label="Stroke Width" state={strokeWidth.kind === "mixed" ? "mixed" : "set"}>
            <InspectorBulkNumberField
              ariaLabel="Stroke Width"
              shared={withSharedFallback(strokeWidth, 1)}
              min={0}
              onCommit={(value) => setSvgObjectsStrokeWidth(svgNode.id, ids, Math.max(0, value))}
            />
          </InspectorPropertyRow>
        </div>
      </InspectorProtectedStyleGroup>
    </InspectorSection>
  );
}
