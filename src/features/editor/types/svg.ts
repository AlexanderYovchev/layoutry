/**
 * SVG Foundation (Checkpoint 1.15.5) — a genuine `<svg>` document
 * primitive, not a fake Shape node or a CSS clip-path preset (see
 * canvas/components/document/elements/SvgElement.tsx's own top comment
 * for the renderer, and this checkpoint's own report for the full
 * architectural framing). Deliberately does NOT model arbitrary SVG
 * descendants (path/rect/circle/polygon as independent editor nodes) —
 * that belongs to the later Checkpoint 1.15.6 SVG Drawing Tool. Instead,
 * one SVG node owns a small, closed set of dedicated typed fields
 * (EditorElementNode.svgKind/svgViewBox/svgFill/svgStroke/
 * svgStrokeWidth) and one starter geometry primitive.
 *
 * Fields are FLAT top-level fields on EditorElementNode, each with its
 * own independent setter — the same shape Video's own src/poster/
 * controls/autoplay/muted/loop already established, not a single grouped
 * settings object the way border/background/display are. This is a
 * deliberate departure from the "grouped settings object" convention
 * those CSS-property families use: SVG's own fields split into two
 * genuinely different mutation categories (Fill/Stroke/StrokeWidth are
 * CSS-like styling, guarded by Parent Style Protection; Primitive/
 * ViewBox are vector content, never guarded — see setSvgKind/
 * setSvgViewBox vs setSvgFill/setSvgStroke/setSvgStrokeWidth in
 * commands/svgCommands.ts), and flat independently-guardable fields keep
 * that split trivial at the store-action layer with zero extra
 * per-field plumbing inside a shared settings object.
 */

export type SvgPrimitiveKind = "rectangle" | "circle" | "triangle" | "star";

export const SVG_PRIMITIVE_KINDS: readonly SvgPrimitiveKind[] = [
  "rectangle",
  "circle",
  "triangle",
  "star",
];

export function isValidSvgPrimitiveKind(value: unknown): value is SvgPrimitiveKind {
  return typeof value === "string" && (SVG_PRIMITIVE_KINDS as readonly string[]).includes(value);
}

/** A node with no explicit svgKind renders as the default starter Rectangle — see resolveShapeStyle-style resolvers elsewhere in this codebase for the identical "unset/malformed -> safe default" convention. */
export function getSvgKind(node: { svgKind?: SvgPrimitiveKind }): SvgPrimitiveKind {
  if (node.svgKind === undefined) return "rectangle";
  return isValidSvgPrimitiveKind(node.svgKind) ? node.svgKind : "rectangle";
}

export interface SvgViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/** 0 0 100 100 — every starter primitive's own coordinates (see canvas/utils/svgPrimitiveGeometry.ts) are authored against this exact box. */
export const DEFAULT_SVG_VIEW_BOX: SvgViewBox = { minX: 0, minY: 0, width: 100, height: 100 };

/** Width/height must stay positive for `viewBox` to mean anything; minX/minY may be any finite number (a negative min is ordinary, valid SVG). */
export function isValidSvgViewBox(value: unknown): value is SvgViewBox {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SvgViewBox>;
  return (
    typeof candidate.minX === "number" &&
    Number.isFinite(candidate.minX) &&
    typeof candidate.minY === "number" &&
    Number.isFinite(candidate.minY) &&
    typeof candidate.width === "number" &&
    Number.isFinite(candidate.width) &&
    candidate.width > 0 &&
    typeof candidate.height === "number" &&
    Number.isFinite(candidate.height) &&
    candidate.height > 0
  );
}

/** Never lets a malformed/legacy stored viewBox reach the renderer — falls back to DEFAULT_SVG_VIEW_BOX exactly like an unset one, per this checkpoint's own "never let invalid committed data crash rendering" requirement. */
export function resolveSvgViewBox(node: { svgViewBox?: SvgViewBox }): SvgViewBox {
  if (node.svgViewBox === undefined) return DEFAULT_SVG_VIEW_BOX;
  return isValidSvgViewBox(node.svgViewBox) ? node.svgViewBox : DEFAULT_SVG_VIEW_BOX;
}

/** The exact `viewBox` attribute string SVG expects: "minX minY width height". */
export function formatSvgViewBox(viewBox: SvgViewBox): string {
  return `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`;
}

/** A visibly-distinct starter accent (Tailwind's blue-500, already this app's own Inspector focus-ring color) rather than plain black — a freshly-inserted SVG should read as "a real, intentional graphic," not a flat silhouette. Real native SVG initial value ("black") is used only as the RENDER-time fallback for a node whose fill was explicitly reset — see resolveSvgFill — never as the factory's own default. */
export const DEFAULT_SVG_FILL = "#3b82f6";

/** Native SVG's own initial `fill` value is black — used only once a fill has been explicitly cleared (Reset), never as the factory's own starter color (see DEFAULT_SVG_FILL). */
export function resolveSvgFill(node: { svgFill?: string }): string {
  return node.svgFill ?? "#000000";
}

/** Unset means no stroke at all (native SVG's own initial `stroke` value is already "none") — the renderer simply omits the `stroke` attribute rather than writing an explicit "none", matching Checkpoint 1.15.4's identical "none maps to an omitted property" convention for Shape. */
export function resolveSvgStroke(node: { svgStroke?: string }): string | undefined {
  return node.svgStroke;
}

/** Native SVG's own initial `stroke-width` is 1 — used as the resolved/displayed value for an unset field regardless of whether stroke itself is currently set, since Stroke Width is preserved independently of Stroke being toggled to None (section 17 of this checkpoint's own brief — do not destructively reset it). */
export function resolveSvgStrokeWidth(node: { svgStrokeWidth?: number }): number {
  return node.svgStrokeWidth ?? 1;
}
