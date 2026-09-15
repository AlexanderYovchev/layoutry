"use client";

import { DEFAULT_SVG_FILL } from "@/features/editor/types/svg";
import { formatSvgPoints, pathCommandsToD } from "@/features/editor/utils/svgObjectGeometry";
import type { SvgVectorObject } from "@/features/editor/types/svgScene";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface SvgVectorObjectHandlers {
  onPointerDown: (event: ReactPointerEvent<SVGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<SVGElement>) => void;
}

interface SvgVectorObjectRendererProps {
  object: SvgVectorObject;
  /** The Select tool's own move-session handlers (see useSvgObjectMoveSession) — omitted entirely (not merely inert) while any other tool is active, so a press on an existing object correctly falls through to the background drawing/path session instead (see SvgElement.tsx's own tool-gating). */
  handlers?: SvgVectorObjectHandlers;
}

/**
 * Renders ONE vector scene object as a genuine native SVG child element —
 * never a canvas bitmap, `<foreignObject>`, generated HTML div, or CSS
 * clip-path (Checkpoint 1.15.6, section H of its own required report:
 * "the renderer must remain genuine vector SVG"). `d`/`points` strings are
 * derived here, at render time, from the object's own structured geometry
 * — the ONE place this component ever turns structured data into a raw
 * attribute string; nothing upstream of this ever stores one.
 */
export function SvgVectorObjectRenderer({ object, handlers }: SvgVectorObjectRendererProps) {
  const presentation = {
    fill: object.fill ?? "none",
    ...(object.stroke ? { stroke: object.stroke, strokeWidth: object.strokeWidth ?? 1 } : {}),
  };

  switch (object.type) {
    case "rect":
      return <rect x={object.x} y={object.y} width={object.width} height={object.height} {...presentation} {...handlers} />;
    case "ellipse":
      return <ellipse cx={object.cx} cy={object.cy} rx={object.rx} ry={object.ry} {...presentation} {...handlers} />;
    case "line":
      // A fill-only line is invisible (a <line> has no fillable area) —
      // always guarantee a visible stroke, matching the Line tool's own
      // creation-defaults fallback (see svgObjectDefaults.ts).
      return (
        <line
          x1={object.x1}
          y1={object.y1}
          x2={object.x2}
          y2={object.y2}
          stroke={object.stroke ?? DEFAULT_SVG_FILL}
          strokeWidth={object.strokeWidth ?? 1}
          {...handlers}
        />
      );
    case "polygon":
      return <polygon points={formatSvgPoints(object.points)} {...presentation} {...handlers} />;
    case "path":
      return <path d={pathCommandsToD(object.commands)} {...presentation} {...handlers} />;
  }
}
