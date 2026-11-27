/**
 * BC-17.2 — CSS counter foundation (P-4; BC-17.1.3 Report 1 §4.11).
 *
 * Counters are document assets (styleAssets.counters) referenced by id, so
 * every element that references one definition shares one sequence, and
 * different definitions never merge even when their display names look
 * alike. The CSS identifier printed for a definition is DERIVED from its
 * name (counterCssIdentifier); an authored name never reaches CSS.
 * Numbering itself is the browser's: nothing rewrites element text.
 */

export interface CounterDefinition {
  id: string;
  /** Display name; unique per document after normalizeAssetName. */
  name: string;
}

export type CounterRef =
  { kind: "document"; id: string } | { kind: "builtin"; name: "list-item" };

export interface CounterOperation {
  counter: CounterRef;
  /** Integer; defaults (when absent) are reset 0, increment 1, set 0. */
  value?: number;
}

/**
 * The counters group. CSS applies an element's resets, then increments,
 * then sets (CSS Lists 3). Each counter may appear once per list.
 */
export interface CounterOperations {
  reset?: CounterOperation[];
  increment?: CounterOperation[];
  set?: CounterOperation[];
}

export const COUNTER_OPERATION_KINDS = [
  "reset",
  "increment",
  "set",
] as const satisfies readonly (keyof CounterOperations)[];

export const PREDEFINED_COUNTER_STYLES = [
  "decimal",
  "decimal-leading-zero",
  "lower-roman",
  "upper-roman",
  "lower-alpha",
  "upper-alpha",
  "lower-greek",
  "disc",
  "circle",
  "square",
  "none",
] as const;
export type PredefinedCounterStyle = (typeof PREDEFINED_COUNTER_STYLES)[number];

/** Only predefined styles; user-authored @counter-style is a scope candidate, not approved. */
export type CounterStyleRef = {
  kind: "predefined";
  style: PredefinedCounterStyle;
};

export const COUNTER_VALUE_LIMIT = 1_000_000;
export const MAX_COUNTER_OPERATIONS = 32;
export const MAX_COUNTER_DEFINITIONS = 1_024;

/** CSS-wide keywords and names a counter identifier must never print as. */
const RESERVED_COUNTER_IDENTIFIERS: ReadonlySet<string> = new Set([
  "none",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "default",
  "list-item",
]);

/** An asset name as a CSS identifier fragment in [a-z0-9-] (counters here; keyframes in canvas/styling/keyframes.ts, BC-17.3.1). */
export function assetIdentifierSlug(
  name: string,
  fallback = "counter",
): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return ascii.length > 0 ? ascii : fallback;
}

/**
 * The CSS identifiers for a document's counter definitions, in definition
 * order: `c-<slug(name)>` in [a-z0-9-], with -2, -3… on collision.
 * Deterministic for the same definitions, never a reserved keyword, never
 * containing an authored character outside [a-z0-9-].
 */
export function counterCssIdentifiers(
  definitions: readonly CounterDefinition[],
): Map<string, string> {
  const used = new Set<string>(RESERVED_COUNTER_IDENTIFIERS);
  const identifiers = new Map<string, string>();
  for (const definition of definitions) {
    const base = `c-${assetIdentifierSlug(definition.name)}`;
    let candidate = base;
    for (let suffix = 2; used.has(candidate); suffix += 1)
      candidate = `${base}-${suffix}`;
    used.add(candidate);
    identifiers.set(definition.id, candidate);
  }
  return identifiers;
}

export function generateCounterId(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `counter-${suffix}`;
}

/** Every counter reference inside a counters group. */
export function counterOperationRefs(
  operations: CounterOperations | undefined,
): CounterRef[] {
  if (!operations) return [];
  return COUNTER_OPERATION_KINDS.flatMap((kind) =>
    (operations[kind] ?? []).map((operation) => operation.counter),
  );
}

/** What the element clipboard carries so a paste can resolve counter references (commands/counterReferenceCommands.ts). */
export interface CopiedCounterContext {
  /** EditorState.documentSessionId at copy time: the session document token (never saved or exported). */
  sourceDocumentSessionId: number;
  /** The definitions the copied subtrees reference, as they were at copy time. */
  counters: CounterDefinition[];
}
