/**
 * The gradient value model (Checkpoint 4.3.1) — lives alongside
 * BackgroundSettings.gradient rather than as a separate top-level node
 * field, since a gradient is always one specific background *source*
 * (see background.ts's BackgroundSourceType), not an independent style
 * concern. Structured data is the canonical model; raw gradient CSS
 * text is never stored — see formatGradientCss, the one place this
 * model becomes a CSS string, always generated fresh from these fields.
 *
 * Stops carry a stable `id` (see generateGradientStopId) rather than
 * relying on array position — dragging, adding, and removing stops all
 * reorder/resize the array, and the Inspector's selected-stop state
 * (kept outside the document model entirely — see
 * InspectorGradientSection) must survive all of that by identity, never
 * by index.
 */

import { BACKGROUND_POSITION_CSS, type BackgroundPosition } from "@/features/editor/types/background";
import { isValidCssColor } from "@/features/editor/utils/cssColor";

export type GradientType = "linear" | "radial";
export type RadialGradientShape = "ellipse" | "circle";

export interface GradientColorStop {
  id: string;
  /** Any valid CSS color string — see isValidCssColor. Never normalized (an entered rgba()/hsl() stays exactly as typed). */
  color: string;
  /** 0-100, percent along the gradient. */
  position: number;
}

export interface LinearGradientSettings {
  type: "linear";
  /** 0-359 — real CSS `linear-gradient()` angle semantics (0deg = up, 90deg = right, 180deg = down, 270deg = left), NOT conventional math orientation. See isValidGradientSettings/normalizeGradientAngle. */
  angle: number;
  stops: GradientColorStop[];
}

export interface RadialGradientSettings {
  type: "radial";
  shape: RadialGradientShape;
  /** Reuses the same nine-point preset Background Position already uses — `radial-gradient(... at <position>)` accepts the identical position syntax as the `background-position` property. No custom radius/closest-side/farthest-corner/free-XY yet — see this checkpoint's Non-goals; `position` alone already leaves room for a future `size`/custom-radius field to be added later without migrating this one. */
  position: BackgroundPosition;
  stops: GradientColorStop[];
}

export type GradientSettings = LinearGradientSettings | RadialGradientSettings;

/** A gradient must always have at least this many stops — enforced by removeGradientStop (a no-op below this) and isValidGradientSettings (rejects anything with fewer, e.g. a malformed externally-loaded document). */
export const MIN_GRADIENT_STOPS = 2;
/** Keeps preview/track rendering and formatting cheap — see this checkpoint's report for why 16 (Recommended in the brief). addGradientStop no-ops at this limit. */
export const MAX_GRADIENT_STOPS = 16;

const DEFAULT_LINEAR_ANGLE = 90;
const DEFAULT_RADIAL_SHAPE: RadialGradientShape = "ellipse";
const DEFAULT_RADIAL_POSITION: BackgroundPosition = "center";

/** A short, locally-unique id — gradient stops are only ever looked up within their own parent gradient (never globally), so a random suffix without a tag prefix is sufficient; see this checkpoint's report on why duplicated stop ids are safe to preserve as-is. */
export function generateGradientStopId(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `stop-${suffix}`;
}

/** The default two-stop gradient (Checkpoint 4.3.1's "one coherent document change" default) — black to white, clearly visible regardless of the element's own background color. */
function createDefaultStops(): GradientColorStop[] {
  return [
    { id: generateGradientStopId(), color: "#000000", position: 0 },
    { id: generateGradientStopId(), color: "#ffffff", position: 100 },
  ];
}

/** Builds a brand-new gradient of the given type with the default two stops — only used when a node has no stored gradient yet; switching type on an *existing* gradient goes through withGradientType instead, which reuses its stops. */
export function createDefaultGradientSettings(type: GradientType): GradientSettings {
  const stops = createDefaultStops();
  if (type === "linear") return { type: "linear", angle: DEFAULT_LINEAR_ANGLE, stops };
  return { type: "radial", shape: DEFAULT_RADIAL_SHAPE, position: DEFAULT_RADIAL_POSITION, stops };
}

/** Switches Linear/Radial on an existing gradient, reusing its current stops verbatim and resetting only the type-specific fields to their defaults (Checkpoint 4.3.1's "initialize only radial-specific fields where possible") — never remembers a previous radial/linear configuration across a round-trip switch, which would need extra state this checkpoint doesn't add. */
export function withGradientType(current: GradientSettings, type: GradientType): GradientSettings {
  if (current.type === type) return current;
  if (type === "linear") return { type: "linear", angle: DEFAULT_LINEAR_ANGLE, stops: current.stops };
  return { type: "radial", shape: DEFAULT_RADIAL_SHAPE, position: DEFAULT_RADIAL_POSITION, stops: current.stops };
}

/** Stable sort by position — ties preserve their prior relative order (Array.prototype.toSorted, like Array.prototype.sort, is a stable sort per spec). Called after every stop mutation so the canonical stored array is always in render order; the selected-stop-by-id convention means this never disturbs the Inspector's own selection. */
export function sortGradientStops(stops: GradientColorStop[]): GradientColorStop[] {
  return stops.toSorted((a, b) => a.position - b.position);
}

/** Appends a stop and re-sorts — a no-op (same reference) once MAX_GRADIENT_STOPS is reached, so a caller that doesn't check the limit itself still can't exceed it. */
export function addGradientStop(gradient: GradientSettings, stop: GradientColorStop): GradientSettings {
  if (gradient.stops.length >= MAX_GRADIENT_STOPS) return gradient;
  return { ...gradient, stops: sortGradientStops([...gradient.stops, stop]) };
}

/** Removes a stop by id — a no-op (same reference) if the id doesn't exist, or if doing so would drop below MIN_GRADIENT_STOPS, so the model itself can never be pushed into an invalid one/zero-stop state through this helper. */
export function removeGradientStop(gradient: GradientSettings, stopId: string): GradientSettings {
  if (gradient.stops.length <= MIN_GRADIENT_STOPS) return gradient;
  const nextStops = gradient.stops.filter((stop) => stop.id !== stopId);
  if (nextStops.length === gradient.stops.length) return gradient;
  return { ...gradient, stops: nextStops };
}

/** Updates one stop's color and/or position by id, re-sorting afterward — a no-op (same reference) if the id doesn't exist. Position is trusted here (0-100 clamping/rejection is the caller's concern — see InspectorGradientSection's drag-clamp vs typed-reject split, documented in this checkpoint's report). */
export function updateGradientStop(
  gradient: GradientSettings,
  stopId: string,
  patch: Partial<Pick<GradientColorStop, "color" | "position">>,
): GradientSettings {
  let changed = false;
  const stops = gradient.stops.map((stop) => {
    if (stop.id !== stopId) return stop;
    changed = true;
    return { ...stop, ...patch };
  });
  if (!changed) return gradient;
  return { ...gradient, stops: sortGradientStops(stops) };
}

/** The largest gap between consecutive stops (including the edges 0 and 100, treated as implicit boundaries even with no stop exactly there) — used to place a newly added stop somewhere immediately useful rather than on top of an existing one. */
export function computeNewStopPosition(stops: GradientColorStop[]): number {
  const positions = sortGradientStops(stops).map((stop) => stop.position);
  const boundaries = [0, ...positions, 100];
  let bestStart = 0;
  let bestEnd = 100;
  let bestSize = -1;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const size = boundaries[i + 1] - boundaries[i];
    if (size > bestSize) {
      bestSize = size;
      bestStart = boundaries[i];
      bestEnd = boundaries[i + 1];
    }
  }
  return Math.round((bestStart + bestEnd) / 2);
}

/**
 * The nearest existing stop's color, by distance to `position` — a new
 * stop's initial color (Checkpoint 4.3.1's #8: "if interpolation adds
 * too much complexity, copy the nearest stop color and document the
 * choice"). True color interpolation was deliberately not implemented:
 * stops can hold *any* valid CSS color syntax (hex, rgb(), hsl(),
 * keywords), and interpolating between two arbitrary syntaxes correctly
 * would need a real color-space conversion step this checkpoint's scope
 * doesn't justify.
 */
export function nearestStopColor(stops: GradientColorStop[], position: number): string {
  let nearest = stops[0];
  for (const stop of stops) {
    if (Math.abs(stop.position - position) < Math.abs(nearest.position - position)) nearest = stop;
  }
  return nearest.color;
}

/** Wraps an angle into [0, 360) — angles are cyclic (370deg and 10deg render identically), so a typed value outside the documented 0-359 range is normalized rather than rejected, unlike a stop's 0-100 position (a genuine hard boundary — see InspectorGradientSection). Rejects (returns unchanged) only a non-finite input. */
export function normalizeGradientAngle(angle: number): number {
  if (!Number.isFinite(angle)) return angle;
  const wrapped = angle % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function isValidGradientStopPosition(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Defends against a malformed externally-loaded document (this app has
 * no persistence/import feature yet, but the resolver must still never
 * throw on bad data — Checkpoint 4.3.1's #15). Never used to validate
 * Inspector-driven writes, which are already correct by construction —
 * every Inspector command here builds a well-formed GradientSettings
 * directly, it never round-trips through this validator.
 */
export function isValidGradientSettings(value: unknown): value is GradientSettings {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (candidate.type !== "linear" && candidate.type !== "radial") return false;
  if (!Array.isArray(candidate.stops) || candidate.stops.length < MIN_GRADIENT_STOPS) return false;

  const seenIds = new Set<string>();
  for (const stop of candidate.stops) {
    if (typeof stop !== "object" || stop === null) return false;
    const s = stop as Record<string, unknown>;
    if (typeof s.id !== "string" || s.id === "" || seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    if (typeof s.color !== "string" || !isValidCssColor(s.color)) return false;
    if (typeof s.position !== "number" || !isValidGradientStopPosition(s.position)) return false;
  }

  if (candidate.type === "linear") {
    return typeof candidate.angle === "number" && Number.isFinite(candidate.angle);
  }

  return (
    (candidate.shape === "ellipse" || candidate.shape === "circle") &&
    typeof candidate.position === "string" &&
    candidate.position in BACKGROUND_POSITION_CSS
  );
}

function formatStops(stops: GradientColorStop[]): string {
  return sortGradientStops(stops)
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(", ");
}

export function formatLinearGradientCss(gradient: LinearGradientSettings): string {
  return `linear-gradient(${gradient.angle}deg, ${formatStops(gradient.stops)})`;
}

export function formatRadialGradientCss(gradient: RadialGradientSettings): string {
  return `radial-gradient(${gradient.shape} at ${BACKGROUND_POSITION_CSS[gradient.position]}, ${formatStops(gradient.stops)})`;
}

/** The single entry point Canvas rendering (resolveBackgroundStyle) and the Gradient Inspector's own accurate preview both call — never format a gradient any other way, so the preview and Canvas can never drift apart. Returns null for a structurally invalid gradient (see isValidGradientSettings) rather than throwing. */
export function formatGradientCss(gradient: GradientSettings): string | null {
  if (!isValidGradientSettings(gradient)) return null;
  return gradient.type === "linear" ? formatLinearGradientCss(gradient) : formatRadialGradientCss(gradient);
}

/**
 * A type-agnostic, always-horizontal rendering of just the color stops
 * (Checkpoint 4.3.1's #6 stop track) — deliberately NOT the same
 * formatter Canvas/the accurate preview use (formatGradientCss), since a
 * Radial gradient's true 2D appearance has no honest "stretched flat"
 * representation; the track's job is purely to visualize stop color/
 * position along 0-100%, which is identical for both gradient types.
 */
export function formatGradientStopsCss(stops: GradientColorStop[]): string {
  return `linear-gradient(to right, ${formatStops(stops)})`;
}
