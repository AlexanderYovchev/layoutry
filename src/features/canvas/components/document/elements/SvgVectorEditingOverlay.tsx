"use client";

import { useSvgObjectResizeSession, type SvgResizeCorner } from "@/features/canvas/hooks/useSvgObjectResizeSession";
import { findSvgObjectById } from "@/features/editor/types/svgScene";
import { formatSvgPoints, getSvgObjectBounds } from "@/features/editor/utils/svgObjectGeometry";
import type { SvgDraft } from "@/features/editor/types/svgEditMode";
import type { SvgScene } from "@/features/editor/types/svgScene";

interface SvgVectorEditingOverlayProps {
  svgNodeId: string;
  scene: SvgScene;
  selectedSvgObjectIds: string[];
  draft: SvgDraft | null;
}

const SELECTION_COLOR = "#3b82f6";
const HANDLE_RADIUS = 2.5;

/**
 * The Select tool's own lightweight selection feedback (Checkpoint
 * 1.15.6, section I of its own required report: "at minimum a visible
 * bounding box + selected indication... do NOT draw every editable vertex
 * yet"). Renders entirely in the SAME viewBox coordinate space the vector
 * objects themselves live in — unlike the outer document's own
 * SelectionOverlay/ResizeHandles (which must project a measured screen
 * rect into an absolutely-positioned HTML overlay), a bounding box drawn
 * here needs no coordinate conversion at all: it's just another SVG child
 * at the object's own x/y/width/height.
 *
 * Resize handles render only for a SINGLE selected Rectangle or Ellipse —
 * the required v1 scope (section 29 of this checkpoint's own brief);
 * Line/Polygon/Path resize is deliberately deferred (see this
 * checkpoint's own report), so a selected object of any other type (or a
 * multi-selection) gets the bounding box alone, with no handles.
 */
export function SvgVectorEditingOverlay({ svgNodeId, scene, selectedSvgObjectIds, draft }: SvgVectorEditingOverlayProps) {
  const { getHandleHandlers } = useSvgObjectResizeSession(svgNodeId);

  const singleSelected =
    selectedSvgObjectIds.length === 1 ? findSvgObjectById(scene, selectedSvgObjectIds[0]) : undefined;
  const showResizeHandles = singleSelected?.type === "rect" || singleSelected?.type === "ellipse";

  return (
    <g pointerEvents="none">
      {selectedSvgObjectIds.map((objectId) => {
        const object = findSvgObjectById(scene, objectId);
        if (!object) return null;
        const bounds = getSvgObjectBounds(object);
        return (
          <rect
            key={objectId}
            x={bounds.x}
            y={bounds.y}
            width={bounds.width}
            height={bounds.height}
            fill="none"
            stroke={SELECTION_COLOR}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {draft && draft.points.length > 0 && (
        <polyline
          points={formatSvgPoints(draft.points)}
          fill="none"
          stroke={SELECTION_COLOR}
          strokeWidth={1}
          strokeDasharray="4 2"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {showResizeHandles && singleSelected && (
        <ResizeHandleCircles
          bounds={getSvgObjectBounds(singleSelected)}
          objectId={singleSelected.id}
          getHandleHandlers={getHandleHandlers}
        />
      )}
    </g>
  );
}

interface ResizeHandleCirclesProps {
  bounds: { x: number; y: number; width: number; height: number };
  objectId: string;
  getHandleHandlers: ReturnType<typeof useSvgObjectResizeSession>["getHandleHandlers"];
}

function ResizeHandleCircles({ bounds, objectId, getHandleHandlers }: ResizeHandleCirclesProps) {
  const { x, y, width, height } = bounds;
  const corners: Array<{ corner: SvgResizeCorner; point: { x: number; y: number }; anchor: { x: number; y: number }; cursor: string }> = [
    { corner: "nw", point: { x, y }, anchor: { x: x + width, y: y + height }, cursor: "nwse-resize" },
    { corner: "ne", point: { x: x + width, y }, anchor: { x, y: y + height }, cursor: "nesw-resize" },
    { corner: "se", point: { x: x + width, y: y + height }, anchor: { x, y }, cursor: "nwse-resize" },
    { corner: "sw", point: { x, y: y + height }, anchor: { x: x + width, y }, cursor: "nesw-resize" },
  ];

  return (
    <>
      {corners.map(({ corner, point, anchor, cursor }) => (
        <circle
          key={corner}
          cx={point.x}
          cy={point.y}
          r={HANDLE_RADIUS}
          fill={SELECTION_COLOR}
          stroke="#ffffff"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          cursor={cursor}
          pointerEvents="all"
          {...getHandleHandlers(objectId, corner, anchor)}
        />
      ))}
    </>
  );
}
