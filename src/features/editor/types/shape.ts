/**
 * Advanced Container Shapes (Checkpoint 1.15.4) — a CSS styling
 * capability, not a new document node type: a Container stays a
 * Container, a Section stays a Section, only its authored `clip-path`
 * changes (see EditorElementNode.shape's own doc comment). Modeled as a
 * closed preset enum rather than a raw clip-path string for the exact
 * reason typography/background/border/... already store typed settings
 * instead of raw CSS text: a preset can't be malformed, and the one
 * mapping to real CSS lives centrally here (getClipPathForShapePreset),
 * never duplicated between the Canvas renderer, the Inspector preview
 * grid, and tests.
 *
 * "none" (labeled "Rectangle" in the Inspector — see SHAPE_PRESETS) is a
 * real member of the union rather than modeling "no shape" purely as a
 * missing field, so a mixed-selection/bulk read always has a concrete
 * value to compare and display (the same reason getBorderRadiusSettings/
 * getDisplaySettings resolve their own "unset" case to a concrete default
 * object rather than leaving callers to check `undefined` themselves).
 * `EditorElementNode.shape` itself stays `undefined` for the common case
 * (no synthesized default stored on ordinary nodes, matching every other
 * settings field's convention) — getShapePreset resolves that to "none".
 *
 * Future-compatibility (section 34 of this checkpoint's own brief): a
 * later "Custom Polygon" feature can introduce its own discriminated
 * union (e.g. `{ kind: "preset"; preset: ShapePreset } | { kind:
 * "customPolygon"; points }`) without touching this module's own preset
 * table — nothing here assumes preset is the only representation that
 * will ever exist, it just doesn't build that generality prematurely.
 */
export type ShapePreset =
  | "none"
  | "circle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "star"
  | "parallelogram"
  | "trapezoid";

export interface ShapePresetDefinition {
  readonly id: ShapePreset;
  /** User-facing label — "Rectangle" for "none" (section 6 of this checkpoint's own brief: prefer "Rectangle" over "None" in the UI even though the stored id stays "none"). */
  readonly label: string;
  /** The exact `clip-path` value to apply, or `undefined` for "none" — a plain rectangle renders with NO clip-path property at all, not `clip-path: none`, so unset visually behaves exactly like every pre-1.15.4 container already did. */
  readonly clipPath: string | undefined;
}

/**
 * One source of truth for every preset's CSS (section 29/5) — coordinates
 * kept to whole or one-decimal percentages (section 31: readable, not
 * generated to many decimal places). Pentagon/hexagon/octagon/star use a
 * centered, visually regular-looking polygon; star is a plain 10-point
 * alternating outer/inner-radius shape (section 30 — no custom path
 * parsing); parallelogram/trapezoid use simple asymmetric/tapered corners
 * (sections 5's own guidance). Exact percentages are a deliberate,
 * centralized visual choice — nothing about their precision is load-
 * bearing, so a future checkpoint can retune them here without touching
 * any consumer.
 */
export const SHAPE_PRESETS: readonly ShapePresetDefinition[] = [
  { id: "none", label: "Rectangle", clipPath: undefined },
  { id: "circle", label: "Circle", clipPath: "circle(50% at 50% 50%)" },
  { id: "ellipse", label: "Ellipse", clipPath: "ellipse(50% 40% at 50% 50%)" },
  { id: "triangle", label: "Triangle", clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" },
  { id: "diamond", label: "Diamond", clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" },
  {
    id: "pentagon",
    label: "Pentagon",
    clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  },
  {
    id: "hexagon",
    label: "Hexagon",
    clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  },
  {
    id: "octagon",
    label: "Octagon",
    clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
  },
  {
    id: "star",
    label: "Star",
    clipPath:
      "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  },
  {
    id: "parallelogram",
    label: "Parallelogram",
    clipPath: "polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)",
  },
  { id: "trapezoid", label: "Trapezoid", clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)" },
];

const SHAPE_PRESET_BY_ID: ReadonlyMap<ShapePreset, ShapePresetDefinition> = new Map(
  SHAPE_PRESETS.map((preset) => [preset.id, preset]),
);

export const SHAPE_PRESET_IDS: readonly ShapePreset[] = SHAPE_PRESETS.map((preset) => preset.id);

export function isValidShapePreset(value: unknown): value is ShapePreset {
  return typeof value === "string" && SHAPE_PRESET_BY_ID.has(value as ShapePreset);
}

/** Every ShapePreset member has a table entry by construction (SHAPE_PRESET_IDS is derived from the same table) — this never falls through to a missing definition for a value that already passed isValidShapePreset. */
export function getShapePresetDefinition(preset: ShapePreset): ShapePresetDefinition {
  const definition = SHAPE_PRESET_BY_ID.get(preset);
  if (!definition) throw new Error(`Unknown shape preset: ${preset}`);
  return definition;
}

export function getClipPathForShapePreset(preset: ShapePreset): string | undefined {
  return getShapePresetDefinition(preset).clipPath;
}

/** A node with no explicit shape renders as an ordinary rectangle — see resolveShapeStyle. Malformed loaded-document data (an unrecognized string) also resolves to "none" rather than throwing, the same defensive convention resolveBorderRadiusStyle's per-corner validity check uses. */
export function getShapePreset(node: { shape?: ShapePreset }): ShapePreset {
  if (node.shape === undefined) return "none";
  return isValidShapePreset(node.shape) ? node.shape : "none";
}
