/**
 * Hard limits for loading (and therefore writing) a project file. Project
 * files are untrusted input; these bound memory, CPU and recursion so a
 * hostile file cannot hang or crash the editor, while leaving generous
 * headroom for real projects. Rationale per limit:
 */
export interface ProjectLimits {
  /**
   * Text length of the whole file (UTF-16 code units ≈ characters).
   * 16 Mi: the starter page is ~5 KB; thousands of elements stay well under
   * 2 MB; the headroom is for inline data: URLs in image/background fields.
   */
  maxFileCharacters: number;
  /**
   * Authored elements in one document. 20,000 is far beyond what the
   * Canvas can usefully render; it bounds validation and render cost.
   */
  maxElementNodes: number;
  /**
   * Element nesting depth, root = 1. Real layouts rarely exceed 20–30;
   * 100 keeps the (recursive) schema validation and renderers far from
   * any stack limit.
   */
  maxElementDepth: number;
  /**
   * JSON nesting depth checked BEFORE schema validation, iteratively, so
   * deep hostile input never reaches recursive code. Each element level is
   * two JSON levels (node object + children array); settings objects add
   * at most ~6 more (svgScene path commands are the deepest).
   */
  maxJsonDepth: number;
  /** Total JSON values (objects, arrays, primitives) — bounds validation work. */
  maxJsonValues: number;
}

export const DEFAULT_PROJECT_LIMITS: ProjectLimits = {
  maxFileCharacters: 16 * 1024 * 1024,
  maxElementNodes: 20_000,
  maxElementDepth: 100,
  maxJsonDepth: 2 * 100 + 16,
  maxJsonValues: 2_000_000,
};

/** Keys that are never legitimate in a project file (prototype-pollution vectors). */
export const FORBIDDEN_JSON_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);
