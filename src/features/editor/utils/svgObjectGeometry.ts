import type {
  SvgEllipseObject,
  SvgLineObject,
  SvgPathCommand,
  SvgRectObject,
  SvgVectorObject,
  SvgVectorPoint,
} from "@/features/editor/types/svgScene";

/**
 * Centralized vector-object geometry math (Checkpoint 1.15.6, section 51
 * of its own brief: "do not scatter geometry math across React
 * components"). Every function here is pure — no DOM, no store — so the
 * Select-tool move/resize sessions, the drawing-tool commit paths, and
 * this module's own tests all share exactly one implementation.
 *
 * Coordinates are rounded to 2 decimal places wherever a pointer-derived
 * value is produced (section 59 of this checkpoint's own brief) — enough
 * precision to feel accurate while never storing values like
 * `37.492857192847`.
 */

const PRECISION = 100;

export function roundSvgCoordinate(value: number): number {
  return Math.round(value * PRECISION) / PRECISION;
}

export interface SvgObjectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The axis-aligned bounding box of any vector object — what the Select tool's own selection-overlay rectangle and (for rect/ellipse) the resize handles are drawn from. */
export function getSvgObjectBounds(object: SvgVectorObject): SvgObjectBounds {
  switch (object.type) {
    case "rect":
      return { x: object.x, y: object.y, width: object.width, height: object.height };
    case "ellipse":
      return { x: object.cx - object.rx, y: object.cy - object.ry, width: object.rx * 2, height: object.ry * 2 };
    case "line":
      return boundsFromPoints([
        { x: object.x1, y: object.y1 },
        { x: object.x2, y: object.y2 },
      ]);
    case "polygon":
      return boundsFromPoints(object.points);
    case "path":
      return boundsFromPoints(
        object.commands.filter((command): command is Extract<SvgPathCommand, { kind: "M" | "L" }> => command.kind !== "Z"),
      );
  }
}

function boundsFromPoints(points: readonly SvgVectorPoint[]): SvgObjectBounds {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** Shifts every one of an object's own coordinates by (dx, dy) — used by both the live Select-tool move preview and its final commit, so the two can never disagree. */
export function translateSvgObjectGeometry<T extends SvgVectorObject>(object: T, dx: number, dy: number): T {
  switch (object.type) {
    case "rect":
      return { ...object, x: roundSvgCoordinate(object.x + dx), y: roundSvgCoordinate(object.y + dy) } as T;
    case "ellipse":
      return { ...object, cx: roundSvgCoordinate(object.cx + dx), cy: roundSvgCoordinate(object.cy + dy) } as T;
    case "line":
      return {
        ...object,
        x1: roundSvgCoordinate(object.x1 + dx),
        y1: roundSvgCoordinate(object.y1 + dy),
        x2: roundSvgCoordinate(object.x2 + dx),
        y2: roundSvgCoordinate(object.y2 + dy),
      } as T;
    case "polygon":
      return {
        ...object,
        points: object.points.map((point) => ({ x: roundSvgCoordinate(point.x + dx), y: roundSvgCoordinate(point.y + dy) })),
      } as T;
    case "path":
      return {
        ...object,
        commands: object.commands.map((command) =>
          command.kind === "Z" ? command : { ...command, x: roundSvgCoordinate(command.x + dx), y: roundSvgCoordinate(command.y + dy) },
        ),
      } as T;
  }
}

/**
 * Resizes a Rectangle or Ellipse to a new bounding box (section 29 of
 * this checkpoint's own brief: Rectangle/Ellipse resize is the required
 * v1 scope; Polygon/Path proportional bounding-box scaling is explicitly
 * deferred — see this checkpoint's own report). Width/height are floored
 * at a small minimum so a resize can never collapse an object to zero or
 * negative size.
 */
const MIN_OBJECT_SIZE = 1;

export function resizeRectOrEllipseToBounds<T extends SvgRectObject | SvgEllipseObject>(
  object: T,
  bounds: SvgObjectBounds,
): T {
  const width = Math.max(MIN_OBJECT_SIZE, roundSvgCoordinate(bounds.width));
  const height = Math.max(MIN_OBJECT_SIZE, roundSvgCoordinate(bounds.height));
  const x = roundSvgCoordinate(bounds.x);
  const y = roundSvgCoordinate(bounds.y);

  if (object.type === "rect") {
    return { ...object, x, y, width, height } as T;
  }
  return { ...object, cx: roundSvgCoordinate(x + width / 2), cy: roundSvgCoordinate(y + height / 2), rx: width / 2, ry: height / 2 } as T;
}

/** Normalizes a pointer drag (which may go in any of the four directions) into a non-negative bounding box — Rectangle/Ellipse drawing and resize both funnel through this so neither ever stores a negative width/height (section 16 of this checkpoint's own brief). */
export function normalizeDragToBounds(startX: number, startY: number, currentX: number, currentY: number): SvgObjectBounds {
  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  return {
    x: roundSvgCoordinate(x),
    y: roundSvgCoordinate(y),
    width: roundSvgCoordinate(Math.abs(currentX - startX)),
    height: roundSvgCoordinate(Math.abs(currentY - startY)),
  };
}

/** A drag this small is almost certainly an accidental click, not an intentional shape (section 58 of this checkpoint's own brief). Shared by every drag-to-draw tool's own commit check. */
export const MIN_DRAG_DISTANCE = 3;

export function isDegenerateDrag(bounds: SvgObjectBounds): boolean {
  return bounds.width < MIN_DRAG_DISTANCE || bounds.height < MIN_DRAG_DISTANCE;
}

export function distanceBetween(a: SvgVectorPoint, b: SvgVectorPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** SVG's own `points` attribute format: "x1,y1 x2,y2 ...". */
export function formatSvgPoints(points: readonly SvgVectorPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

/** Structured path commands -> the exact `d` string SVG expects — the ONE place raw `d` is ever produced (section 21/G of this checkpoint's own brief: `d` is derived, never authored source of truth). */
export function pathCommandsToD(commands: readonly SvgPathCommand[]): string {
  return commands
    .map((command) => (command.kind === "Z" ? "Z" : `${command.kind} ${command.x} ${command.y}`))
    .join(" ");
}

export function isValidSvgPolygon(points: readonly SvgVectorPoint[]): boolean {
  return points.length >= 3;
}

export function isValidSvgPath(commands: readonly SvgPathCommand[]): boolean {
  return commands.length >= 2 && commands[0].kind === "M" && commands.some((command) => command.kind === "L");
}

/** The Line tool's own "meaningful length" floor (section 58/67 of this checkpoint's own brief) — a Line has no area, so MIN_DRAG_DISTANCE's bounding-box check doesn't apply; point-to-point distance is the right measure instead. */
export const MIN_LINE_LENGTH = 3;

export function isDegenerateLine(line: SvgLineObject): boolean {
  return distanceBetween({ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }) < MIN_LINE_LENGTH;
}
