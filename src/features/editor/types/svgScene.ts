/**
 * The SVG Drawing Tool's internal vector scene (Checkpoint 1.15.6) — a
 * dedicated, SVG-LOCAL model, deliberately NOT a tree of
 * `EditorElementNode`s. A vector object is not an HTML layout element:
 * it must never participate in Flow/Flex/Grid/Free, HTML nesting rules,
 * the Structure tree, HTML capability intersection, or the HTML resize/
 * selection system. The SVG document node remains the one and only
 * `EditorElementNode` — see EditorElementNode.svgScene's own doc comment
 * in document.ts, and SvgElement.tsx's own top comment for how the two
 * models meet at render time.
 *
 * Every object has a stable internal vector id (generated via the same
 * generateNodeId utility every EditorElementNode id already uses — see
 * commands/svgSceneCommands.ts) that is NOT an HTML id, NOT an
 * EditorElementNode id, and is never exported as a DOM attribute; it
 * exists purely for editor-local identity (selection, targeted
 * mutation, React keys).
 */

export type SvgVectorObjectKind = "rect" | "ellipse" | "line" | "polygon" | "path";

export interface SvgVectorPoint {
  x: number;
  y: number;
}

/**
 * Structured path commands (section 21 of this checkpoint's own brief) —
 * NOT a raw `d` string. Only straight-segment drawing is supported in
 * this checkpoint (a v1, explicitly-scoped "Pen" tool — see
 * canvas/hooks/useSvgPenSession.ts's own doc comment); Bezier commands
 * (C/Q/S/T) are deliberately not modeled yet, so the union can grow
 * later without migrating already-authored paths.
 */
export type SvgPathCommand = { kind: "M"; x: number; y: number } | { kind: "L"; x: number; y: number } | { kind: "Z" };

interface SvgVectorObjectBase {
  /** Editor-local vector identity only — see this module's own top comment. */
  id: string;
  /** Real SVG presentation attribute, guarded by Parent Style Protection — see setSvgObjectFill's own doc comment. Unset resolves to the owning SVG's own current default (see resolveVectorObjectFill). */
  fill?: string;
  /** Real SVG presentation attribute, guarded like fill. Unset means "no stroke" (matches the owning SVG's own legacy svgStroke convention). */
  stroke?: string;
  /** Real SVG presentation attribute, guarded like fill/stroke. Preserved independently of stroke being toggled off, the same convention svgStrokeWidth already established in Checkpoint 1.15.5. */
  strokeWidth?: number;
}

export interface SvgRectObject extends SvgVectorObjectBase {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SvgEllipseObject extends SvgVectorObjectBase {
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface SvgLineObject extends SvgVectorObjectBase {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SvgPolygonObject extends SvgVectorObjectBase {
  type: "polygon";
  points: SvgVectorPoint[];
}

export interface SvgPathObject extends SvgVectorObjectBase {
  type: "path";
  commands: SvgPathCommand[];
}

export type SvgVectorObject = SvgRectObject | SvgEllipseObject | SvgLineObject | SvgPolygonObject | SvgPathObject;

/**
 * Deliberately just `{ objects }` — no layers/groups/versioning yet
 * (section 5 of this checkpoint's own brief: "do NOT over-engineer").
 * Array ORDER is the one piece of structure this already carries, and it
 * is meaningful: it IS native SVG paint order (later object renders
 * above earlier — see SvgElement.tsx), so no separate z-index concept
 * was introduced.
 */
export interface SvgScene {
  objects: SvgVectorObject[];
}

export function isValidSvgVectorObjectKind(value: unknown): value is SvgVectorObjectKind {
  return value === "rect" || value === "ellipse" || value === "line" || value === "polygon" || value === "path";
}

/** A missing/malformed scene resolves to an empty one — see SvgElement.tsx's own legacy-vs-scene rendering branch, which treats an empty scene exactly like an absent one (falls back to the 1.15.5 starter-primitive rendering). */
export function resolveSvgScene(node: { svgScene?: SvgScene }): SvgScene {
  if (!node.svgScene || !Array.isArray(node.svgScene.objects)) return { objects: [] };
  return node.svgScene;
}

/** Whether `node` has already been materialized into scene mode — see this checkpoint's own migration strategy (report section C). */
export function hasSvgScene(node: { svgScene?: SvgScene }): boolean {
  return resolveSvgScene(node).objects.length > 0;
}

export function findSvgObjectById(scene: SvgScene, objectId: string): SvgVectorObject | undefined {
  return scene.objects.find((object) => object.id === objectId);
}
