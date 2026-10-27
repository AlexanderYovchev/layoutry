"use client";

import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type Ref } from "react";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { useSvgObjectMoveSession } from "@/features/canvas/hooks/useSvgObjectMoveSession";
import { useSvgPathDrawingInteraction } from "@/features/canvas/hooks/useSvgPathDrawingInteraction";
import { useSvgShapeDrawingSession } from "@/features/canvas/hooks/useSvgShapeDrawingSession";
import { SvgVectorEditingOverlay } from "@/features/canvas/components/document/elements/SvgVectorEditingOverlay";
import { SvgVectorObjectRenderer } from "@/features/canvas/components/document/elements/SvgVectorObjectRenderer";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveSvgElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { cn, mergeRefs } from "@/lib/utils";
import {
  SVG_CIRCLE_GEOMETRY,
  SVG_RECTANGLE_GEOMETRY,
  SVG_STAR_POINTS,
  SVG_TRIANGLE_POINTS,
} from "@/features/editor/utils/svgPrimitiveGeometry";
import {
  formatSvgViewBox,
  getSvgKind,
  resolveSvgFill,
  resolveSvgStroke,
  resolveSvgStrokeWidth,
  resolveSvgViewBox,
} from "@/features/editor/types/svg";
import { hasSvgScene, resolveSvgScene } from "@/features/editor/types/svgScene";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * A minimal, purpose-built props shape for the starter geometry's own
 * presentation attributes — deliberately NOT React's generic
 * `SVGProps<SVGElement>` (its own broad `ref?: Ref<SVGElement>` field
 * would collide with `<rect>`/`<circle>`/`<polygon>`'s own more specific
 * ref types the moment it's spread onto them, since this component never
 * needs to forward a ref onto the starter geometry itself).
 */
interface SvgGeometryPresentationProps {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * The genuine SVG renderer — a real `<svg>` element, not an `<img>`, not a
 * CSS clip-path preset, not a serialized markup blob (see types/svg.ts's
 * own top comment for the full architectural framing). Unlike
 * ImageElement/VideoElement, there is NO outer wrapper: `<svg>` already IS
 * the actual visual element with no separate "object-fit content" concern
 * (SVG's own viewBox does that job natively — see resolveSvgViewBox), so
 * it owns its own layout box, data-node-id, and real HTML identity
 * directly, the same single-element ownership ContainerElement/
 * HeadingElement already use for every ordinary (non-media) leaf/
 * container.
 *
 * Checkpoint 1.15.6 (SVG Drawing Tool Foundation) layers a second,
 * SVG-LOCAL rendering mode on top of the 1.15.5 SVG Foundation's single
 * starter primitive: once `node.svgScene` holds at least one object (see
 * hasSvgScene), every subsequent render draws the SCENE instead of the
 * legacy primitive — the two are never shown simultaneously (section 3 of
 * this checkpoint's own brief). A node still on 0 objects (a genuinely
 * untouched 1.15.5 SVG, or a fresh insertion) keeps rendering the legacy
 * primitive right up until Drawing Mode is entered, at which point
 * `enterSvgEditMode` materializes it into an equivalent scene object in
 * the SAME store action that flips `svgEditingNodeId` — so by the time
 * this component ever sees `svgEditingNodeId === node.id`, the scene is
 * already the source of truth (`useSceneRendering` below reflects that:
 * it also turns on scene-mode purely from being the actively-edited SVG,
 * even in the small window where a test or an unusual caller sets that
 * flag directly against a still-empty scene).
 *
 * Only Layoutry-generated geometry — the legacy starter primitive, or
 * vector objects drawn through the Rectangle/Ellipse/Line/Polygon/Pen
 * tools — is ever rendered here: no `dangerouslySetInnerHTML`, no raw
 * markup field, no external SVG fetching, no arbitrary path `d` editor
 * (this checkpoint's own explicit security boundary). Every vector
 * object's `d`/`points` attribute string is derived at render time from
 * structured geometry by SvgVectorObjectRenderer — never stored as a raw
 * string anywhere upstream.
 */
export function SvgElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);

  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const svgEditingNodeId = useEditorStore((state) => state.svgEditingNodeId);
  const activeSvgTool = useEditorStore((state) => state.activeSvgTool);
  const selectedSvgObjectIds = useEditorStore((state) => state.selectedSvgObjectIds);
  const svgDraft = useEditorStore((state) => state.svgDraft);

  const isEditingThisSvg = svgEditingNodeId === node.id;
  const isSelectTool = isEditingThisSvg && activeSvgTool === "select";
  const isDrawingTool = isEditingThisSvg && (activeSvgTool === "rect" || activeSvgTool === "ellipse" || activeSvgTool === "line");
  const isPathTool = isEditingThisSvg && (activeSvgTool === "polygon" || activeSvgTool === "pen");

  // A bare RefObject (not a callback ref) so the drawing/path-drawing
  // sessions — which need to read/convert real pointer coordinates via
  // the live SVGSVGElement — can share the exact DOM node dnd-kit's own
  // drop/drag callback refs already attach to, without a second ref prop
  // on the <svg> itself.
  const svgElementRef = useRef<SVGSVGElement | null>(null);
  const setSvgElementRef = useCallback((element: HTMLElement | null) => {
    svgElementRef.current = element as unknown as SVGSVGElement | null;
  }, []);

  const drawingSession = useSvgShapeDrawingSession(node, svgElementRef);
  const pathDrawing = useSvgPathDrawingInteraction(svgElementRef);
  const { getObjectHandlers } = useSvgObjectMoveSession(node.id);

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      if (!isEditingThisSvg) {
        // Entering Drawing Mode is a content-authoring gesture, not an
        // outer-document selection change — stopping propagation here
        // keeps CanvasInteractionBoundary's own delegated click listener
        // (which already ran on the preceding single-click half of this
        // double-click and selected this SVG normally) from doing
        // anything further on this second event.
        event.stopPropagation();
        useEditorStore.getState().enterSvgEditMode(node.id);
        return;
      }
      if (isPathTool) {
        pathDrawing.onDoubleClick(event);
      }
    },
    [isEditingThisSvg, isPathTool, node.id, pathDrawing],
  );

  // Select tool only: a press that lands directly on the <svg> root
  // itself (never a bubbled child — every interactive vector object/
  // resize handle stops its own propagation) is empty background, which
  // clears the SVG-local selection. Deliberately pointerDown-based rather
  // than a click listener: a native click still fires after a completed
  // drag-to-draw gesture on the same element, which would otherwise wipe
  // out the selection the drawing session's own pointerUp just set.
  const handleBackgroundPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.target === event.currentTarget) {
        useEditorStore.getState().clearSvgObjectSelection();
      }
    },
    [],
  );

  const recipe = resolveSvgElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

  const viewBox = resolveSvgViewBox(node);
  const useSceneRendering = isEditingThisSvg || hasSvgScene(node);

  const kind = getSvgKind(node);
  const fill = resolveSvgFill(node);
  const stroke = resolveSvgStroke(node);
  const geometryProps: SvgGeometryPresentationProps = {
    fill,
    ...(stroke ? { stroke, strokeWidth: resolveSvgStrokeWidth(node) } : {}),
  };

  const scene = resolveSvgScene(node);

  return (
    <svg
      id={node.htmlId}
      // dnd-kit's own setNodeRef is typed for HTMLElement — every other
      // document element in this app renders an HTML tag, so this is the
      // first ref target that's genuinely an SVGSVGElement instead. Both
      // are real DOM Elements and dnd-kit only ever calls
      // getBoundingClientRect()/addEventListener on whatever is passed in,
      // so this is a safe, deliberate widening, not a real type mismatch.
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, setSvgElementRef) as unknown as Ref<SVGSVGElement>}
      {...documentNodeAttributes(node, parentId)}
      {...({ draggable: false } as Record<string, unknown>)}
      viewBox={formatSvgViewBox(viewBox)}
      className={cn(documentDefaultClasses(recipe.defaults), isDragging && "opacity-40", node.className)}
      // userSelect: "none" is editor-only (it keeps drag-to-draw gestures
      // from selecting text) and deliberately not part of the shared recipe.
      style={{ ...recipe.style, userSelect: "none" }}
      // Dragging the outer document node via dnd-kit and drawing/selecting
      // vector content inside it are mutually exclusive gestures — while
      // this SVG is being edited, the pointer belongs entirely to its own
      // Drawing Mode tools, never to an outer Free/Flow drag.
      {...(isEditingThisSvg ? {} : listeners)}
      // Chromium (and other browsers) can treat a mouse-down-and-drag
      // starting on top of painted SVG content as a native "drag this
      // image" gesture — the same affordance that lets a user drag an
      // <img> out to save it. Left alone, that native drag silently
      // hijacks the pointer stream out from under every one of this
      // SVG's own drag-to-draw/move/resize sessions (discovered via real
      // browser/Playwright verification for this checkpoint — see its own
      // report, section V: a plain mouse-drag starting on the SVG never
      // delivered its pointermove stream at all once native drag took
      // over, with no thrown error). Blocking the browser's own
      // `dragstart` is the standard, universal fix, independent of which
      // pointer-tracking approach (capture vs. window listeners) any
      // individual session uses.
      onDragStart={(event) => event.preventDefault()}
      onDoubleClick={handleDoubleClick}
      {...(isDrawingTool ? { onPointerDown: drawingSession.onPointerDown } : {})}
      {...(isPathTool ? { onClick: pathDrawing.onClick } : {})}
      {...(isSelectTool ? { onPointerDown: handleBackgroundPointerDown } : {})}
    >
      {useSceneRendering ? (
        <>
          {scene.objects.map((object) => (
            <SvgVectorObjectRenderer
              key={object.id}
              object={object}
              handlers={isSelectTool ? getObjectHandlers(object.id) : undefined}
            />
          ))}
          {isEditingThisSvg && (
            <SvgVectorEditingOverlay
              svgNodeId={node.id}
              scene={scene}
              selectedSvgObjectIds={selectedSvgObjectIds}
              draft={svgDraft}
            />
          )}
        </>
      ) : (
        <>
          {kind === "rectangle" && <rect {...SVG_RECTANGLE_GEOMETRY} {...geometryProps} />}
          {kind === "circle" && <circle {...SVG_CIRCLE_GEOMETRY} {...geometryProps} />}
          {kind === "triangle" && <polygon points={SVG_TRIANGLE_POINTS} {...geometryProps} />}
          {kind === "star" && <polygon points={SVG_STAR_POINTS} {...geometryProps} />}
        </>
      )}
    </svg>
  );
}
