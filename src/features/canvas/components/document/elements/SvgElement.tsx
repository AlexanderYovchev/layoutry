"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveAspectRatioStyle } from "@/features/canvas/utils/resolveAspectRatioStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import {
  SVG_CIRCLE_GEOMETRY,
  SVG_RECTANGLE_GEOMETRY,
  SVG_STAR_POINTS,
  SVG_TRIANGLE_POINTS,
} from "@/features/canvas/utils/svgPrimitiveGeometry";
import { cn, mergeRefs } from "@/lib/utils";
import {
  formatSvgViewBox,
  getSvgKind,
  resolveSvgFill,
  resolveSvgStroke,
  resolveSvgStrokeWidth,
  resolveSvgViewBox,
} from "@/features/editor/types/svg";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";
import type { Ref } from "react";

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
 * The genuine SVG Foundation renderer (Checkpoint 1.15.5) — a real
 * `<svg>` element, not an `<img>`, not a CSS clip-path preset, not a
 * serialized markup blob (see types/svg.ts's own top comment for the
 * full architectural framing). Unlike ImageElement/VideoElement, there is
 * NO outer wrapper: `<svg>` already IS the actual visual element with no
 * separate "object-fit content" concern (SVG's own viewBox does that
 * job natively — see resolveSvgViewBox), so it owns its own layout box,
 * data-node-id, and real HTML identity directly, the same single-element
 * ownership ContainerElement/HeadingElement already use for every
 * ordinary (non-media) leaf/container.
 *
 * Only Layoutry-generated starter geometry is ever rendered here — no
 * `dangerouslySetInnerHTML`, no raw markup field, no external SVG
 * fetching (this checkpoint's own explicit security boundary, section
 * 48 of its own brief). fill/stroke/strokeWidth are applied as real SVG
 * *presentation attributes* on the starter geometry's own child element,
 * never as CSS (section 18 of this checkpoint's own brief) — deliberately
 * kept separate from the CSS `background`/`border` this same `<svg>` box
 * can also independently carry (see the style spread below).
 */
export function SvgElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);

  // Same "legacy chrome gets out of the way once real data exists" rule
  // ContainerElement/ImageElement/VideoElement's own usesLegacy* flags
  // already establish: a fixed default height would silently block an
  // explicit ratio-mode Aspect Ratio from ever visibly reshaping an
  // unresized SVG, the exact Checkpoint 5.6 bug those flags were
  // originally found and fixed for. Width has no such conflict (aspect-
  // ratio computes height FROM width), so it stays a fixed default
  // regardless — the same asymmetry Image/Video's own chrome uses.
  const usesLegacyHeightChrome = node.aspectRatio?.mode !== "ratio";

  const kind = getSvgKind(node);
  const viewBox = resolveSvgViewBox(node);
  const fill = resolveSvgFill(node);
  const stroke = resolveSvgStroke(node);
  const geometryProps: SvgGeometryPresentationProps = {
    fill,
    ...(stroke ? { stroke, strokeWidth: resolveSvgStrokeWidth(node) } : {}),
  };

  return (
    <svg
      id={node.htmlId}
      // dnd-kit's own setNodeRef is typed for HTMLElement — every other
      // document element in this app renders an HTML tag, so this is the
      // first ref target that's genuinely an SVGSVGElement instead. Both
      // are real DOM Elements and dnd-kit only ever calls
      // getBoundingClientRect()/addEventListener on whatever is passed in,
      // so this is a safe, deliberate widening, not a real type mismatch.
      ref={mergeRefs<HTMLElement>(dropRef, dragRef) as unknown as Ref<SVGSVGElement>}
      {...documentNodeAttributes(node, parentId)}
      viewBox={formatSvgViewBox(viewBox)}
      className={cn("w-50", usesLegacyHeightChrome && "h-50", isDragging && "opacity-40", node.className)}
      style={{
        ...resolvePositionStyle(node),
        ...elementPositionStyle(node, parentLayoutMode),
        ...resolveAspectRatioStyle(node),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveDisplayStyle(node),
      }}
      {...listeners}
    >
      {kind === "rectangle" && <rect {...SVG_RECTANGLE_GEOMETRY} {...geometryProps} />}
      {kind === "circle" && <circle {...SVG_CIRCLE_GEOMETRY} {...geometryProps} />}
      {kind === "triangle" && <polygon points={SVG_TRIANGLE_POINTS} {...geometryProps} />}
      {kind === "star" && <polygon points={SVG_STAR_POINTS} {...geometryProps} />}
    </svg>
  );
}
