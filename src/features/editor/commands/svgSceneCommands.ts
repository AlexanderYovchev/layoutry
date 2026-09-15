import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { getSvgKind, resolveSvgFill, resolveSvgStroke, resolveSvgStrokeWidth } from "@/features/editor/types/svg";
import {
  SVG_CIRCLE_GEOMETRY,
  SVG_RECTANGLE_GEOMETRY,
  SVG_STAR_POINT_LIST,
  SVG_TRIANGLE_POINT_LIST,
} from "@/features/editor/utils/svgPrimitiveGeometry";
import { resolveSvgScene } from "@/features/editor/types/svgScene";
import { resizeRectOrEllipseToBounds, translateSvgObjectGeometry, type SvgObjectBounds } from "@/features/editor/utils/svgObjectGeometry";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { SvgEllipseObject, SvgRectObject, SvgScene, SvgVectorObject } from "@/features/editor/types/svgScene";

/**
 * SVG Drawing Tool document commands (Checkpoint 1.15.6) — the exact
 * immutable/structural-sharing shape every other command in this
 * codebase already uses, applied to the one new `svgScene` field:
 * returns a new root only along the path that actually changed, a true
 * no-op (same reference) if svgNodeId doesn't exist or nothing changes,
 * never mutates the existing objects array/its own entries in place.
 *
 * Every command here operates purely on the DOCUMENT tree — the style-
 * vs-content Parent Style Protection guard (Fill/Stroke/StrokeWidth
 * guarded, everything else here unguarded) is applied entirely at the
 * store layer (useEditorStore.ts), never in this file, matching
 * commands/svgCommands.ts's own identical split.
 */

/** The one shared recursive node-updater every command below is built on — finds svgNodeId anywhere in the tree and replaces its `svgScene` with whatever `updateScene` returns (or leaves the tree completely untouched, same reference, if svgNodeId doesn't exist). */
function updateSvgNodeScene(
  root: EditorElementNode,
  svgNodeId: string,
  updateScene: (scene: SvgScene) => SvgScene,
): EditorElementNode {
  if (root.id === svgNodeId) {
    const nextScene = updateScene(resolveSvgScene(root));
    if (nextScene === root.svgScene) return root;
    return { ...root, svgScene: nextScene };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = updateSvgNodeScene(child, svgNodeId, updateScene);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/** Generates a fresh, editor-local-only vector object id — same generateNodeId utility every EditorElementNode id already uses (see types/svgScene.ts's own top comment for why this is NOT an EditorElementNode id). */
export function generateSvgObjectId(kind: SvgVectorObject["type"]): string {
  return generateNodeId(kind);
}

/**
 * Converts a 1.15.5 "legacy/simple" SVG (one svgKind starter primitive)
 * into an equivalent one-object scene — this checkpoint's own migration
 * strategy (section 6 of its own brief). A no-op if the scene is already
 * populated (never re-materializes, never overwrites existing vector
 * objects). Reads the exact same starter-geometry coordinates
 * SvgElement.tsx's own legacy render path uses (svgPrimitiveGeometry.ts)
 * so the materialized object is visually IDENTICAL to what was already
 * on screen — the whole point of a migration, not a reset. The
 * materialized object's own fill/stroke/strokeWidth are seeded from the
 * SVG's existing resolved legacy values (resolveSvgFill/Stroke/
 * StrokeWidth), so switching into scene mode never visibly changes the
 * SVG's appearance.
 */
function buildMaterializedObject(legacyNode: EditorElementNode): SvgVectorObject {
  const fill = resolveSvgFill(legacyNode);
  const stroke = resolveSvgStroke(legacyNode);
  const strokeWidth = stroke ? resolveSvgStrokeWidth(legacyNode) : undefined;

  switch (getSvgKind(legacyNode)) {
    case "rectangle":
      return { id: generateSvgObjectId("rect"), type: "rect", ...SVG_RECTANGLE_GEOMETRY, fill, stroke, strokeWidth };
    case "circle":
      return {
        id: generateSvgObjectId("ellipse"),
        type: "ellipse",
        cx: SVG_CIRCLE_GEOMETRY.cx,
        cy: SVG_CIRCLE_GEOMETRY.cy,
        rx: SVG_CIRCLE_GEOMETRY.r,
        ry: SVG_CIRCLE_GEOMETRY.r,
        fill,
        stroke,
        strokeWidth,
      };
    case "triangle":
      return { id: generateSvgObjectId("polygon"), type: "polygon", points: [...SVG_TRIANGLE_POINT_LIST], fill, stroke, strokeWidth };
    case "star":
      return { id: generateSvgObjectId("polygon"), type: "polygon", points: [...SVG_STAR_POINT_LIST], fill, stroke, strokeWidth };
  }
}

export function materializeSvgStarterIntoScene(root: EditorElementNode, svgNodeId: string): EditorElementNode {
  if (root.id === svgNodeId) {
    if (resolveSvgScene(root).objects.length > 0) return root;
    return { ...root, svgScene: { objects: [buildMaterializedObject(root)] } };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = materializeSvgStarterIntoScene(child, svgNodeId);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/** Appends one new object at the end of the scene (drawing-tool commit) — later objects paint above earlier ones (native SVG order), so a freshly-drawn shape always appears on top. */
export function addSvgObject(root: EditorElementNode, svgNodeId: string, object: SvgVectorObject): EditorElementNode {
  return updateSvgNodeScene(root, svgNodeId, (scene) => ({ objects: [...scene.objects, object] }));
}

/** Removes every targeted object id in one pass — a true no-op (same reference) if none of the ids are present, so a stale/already-deleted id can never spuriously push history. */
export function removeSvgObjects(root: EditorElementNode, svgNodeId: string, objectIds: ReadonlySet<string>): EditorElementNode {
  return updateSvgNodeScene(root, svgNodeId, (scene) => {
    const filtered = scene.objects.filter((object) => !objectIds.has(object.id));
    return filtered.length === scene.objects.length ? scene : { objects: filtered };
  });
}

/**
 * Shifts every targeted object by (dx, dy) — used by both the one-shot
 * commit and the Live per-frame variant (guarded identically at the
 * store layer either way, since movement is vector CONTENT, not
 * styling). `.map()` always returns a NEW array even when every mapped
 * value is unchanged, so — matching setObjectField's own explicit
 * `changed` tracking below — this only ever hands `updateSvgNodeScene` a
 * genuinely new `{ objects }` when at least one targeted id actually
 * existed in the scene; a stale-id-only call (or a real id that happens
 * to already be at this exact position) returns the SAME scene
 * reference, preserving the "no-op is a true no-op" guarantee every
 * other command in this codebase already provides.
 */
export function translateSvgObjects(
  root: EditorElementNode,
  svgNodeId: string,
  objectIds: ReadonlySet<string>,
  dx: number,
  dy: number,
): EditorElementNode {
  if (dx === 0 && dy === 0) return root;
  return updateSvgNodeScene(root, svgNodeId, (scene) => {
    let changed = false;
    const objects = scene.objects.map((object) => {
      if (!objectIds.has(object.id)) return object;
      changed = true;
      return translateSvgObjectGeometry(object, dx, dy);
    });
    return changed ? { objects } : scene;
  });
}

/** Resizes exactly one Rectangle or Ellipse to a new bounding box — a no-op (same scene reference — see translateSvgObjects's own doc comment on why this matters) for any other object type or a stale id (section 29 of this checkpoint's own brief: Polygon/Path resize is explicitly deferred). */
export function resizeSvgObject(root: EditorElementNode, svgNodeId: string, objectId: string, bounds: SvgObjectBounds): EditorElementNode {
  return updateSvgNodeScene(root, svgNodeId, (scene) => {
    let changed = false;
    const objects = scene.objects.map((object) => {
      if (object.id !== objectId || (object.type !== "rect" && object.type !== "ellipse")) return object;
      changed = true;
      return resizeRectOrEllipseToBounds(object as SvgRectObject | SvgEllipseObject, bounds);
    });
    return changed ? { objects } : scene;
  });
}

/** Moves exactly one Line's second endpoint — the Line tool's own drag-to-draw and (section 29's "preferred if clean") post-creation endpoint-editing both funnel through this. A no-op (same scene reference) for any other object type or a stale id. */
export function setSvgLineEndpoint(root: EditorElementNode, svgNodeId: string, objectId: string, x2: number, y2: number): EditorElementNode {
  return updateSvgNodeScene(root, svgNodeId, (scene) => {
    let changed = false;
    const objects = scene.objects.map((object) => {
      if (object.id !== objectId || object.type !== "line") return object;
      changed = true;
      return { ...object, x2, y2 };
    });
    return changed ? { objects } : scene;
  });
}

/** The symmetric counterpart to setSvgLineEndpoint, for the first endpoint — the Vector Inspector's own X1/Y1 fields are the one caller (the Line tool's drag-to-draw always fixes x1/y1 at pointer-down and only ever moves x2/y2 live, so this is never on that hot path). Same no-op contract. */
export function setSvgLineStart(root: EditorElementNode, svgNodeId: string, objectId: string, x1: number, y1: number): EditorElementNode {
  return updateSvgNodeScene(root, svgNodeId, (scene) => {
    let changed = false;
    const objects = scene.objects.map((object) => {
      if (object.id !== objectId || object.type !== "line") return object;
      changed = true;
      return { ...object, x1, y1 };
    });
    return changed ? { objects } : scene;
  });
}

function setObjectField<K extends "fill" | "stroke" | "strokeWidth">(
  root: EditorElementNode,
  svgNodeId: string,
  objectIds: ReadonlySet<string>,
  field: K,
  value: SvgVectorObject[K],
): EditorElementNode {
  return updateSvgNodeScene(root, svgNodeId, (scene) => {
    let changed = false;
    const objects = scene.objects.map((object) => {
      if (!objectIds.has(object.id) || object[field] === value) return object;
      changed = true;
      return { ...object, [field]: value };
    });
    return changed ? { objects } : scene;
  });
}

export function setSvgObjectsFill(root: EditorElementNode, svgNodeId: string, objectIds: ReadonlySet<string>, fill: string | undefined): EditorElementNode {
  return setObjectField(root, svgNodeId, objectIds, "fill", fill);
}

export function setSvgObjectsStroke(root: EditorElementNode, svgNodeId: string, objectIds: ReadonlySet<string>, stroke: string | undefined): EditorElementNode {
  return setObjectField(root, svgNodeId, objectIds, "stroke", stroke);
}

export function setSvgObjectsStrokeWidth(root: EditorElementNode, svgNodeId: string, objectIds: ReadonlySet<string>, strokeWidth: number): EditorElementNode {
  return setObjectField(root, svgNodeId, objectIds, "strokeWidth", Math.max(0, strokeWidth));
}
