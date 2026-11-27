import type { CssDeclaration } from "@/features/canvas/types/documentDefaultStyle";

/*
 * BC-17.3 — the shared stylesheet compiler's intermediate representation
 * (BC-17.1.3 Report 1 §8.1). The compiler (compileNodeStyle) is pure and
 * produces one NodeStyleIR per document node; the printer
 * (printStyleRules) turns rules into CSS text; surface adapters decide
 * where that text goes (the Design/Preview StyleSheetHost, the export
 * stylesheet). Selectors are STRUCTURED: class tokens plus fragments from
 * the compiler's own constant tables — never authored selector text.
 */

/** Where a stylesheet is used. Design and Preview share one renderer; Export is its own document. */
export type StyleSurface = "design" | "preview" | "export";

/**
 * Global cascade buckets (Report 1 §6.4). Every rule of the whole sheet is
 * printed in bucket order, so precedence never depends on document or
 * insertion order. Within a bucket, role-group rules (tier 0) come before
 * an element's own rules (tier 1).
 */
export const STYLE_BUCKET = {
  defaults: 0,
  base: 1,
  ancestor: 2,
  hover: 3,
  "focus-within": 4,
  focus: 5,
  "focus-visible": 6,
  active: 7,
  open: 8,
  expanded: 8,
  selected: 9,
  current: 9,
  checked: 10,
  indeterminate: 10,
  "placeholder-shown": 11,
  required: 11,
  "read-only": 11,
  compound: 12,
  invalid: 13,
  disabled: 14,
} as const;
export const STYLE_BUCKET_COUNT = 15;

export type StyleRuleTier = 0 | 1;

/**
 * One generated selector. Printed as
 *   .subject[ > :where(chain…)][:where(condition)…][:where(.ancestor<cond> *)][::pseudo]
 * with the subject wrapped in :where() for the order-0 defaults. Every
 * piece is a validated class token or a compiler constant, so the
 * specificity is always (0,1,0) (+ (0,0,1) with a pseudo-element), or
 * (0,0,0) for defaults.
 */
export interface StyleSelector {
  subject: string;
  where?: boolean;
  /** Child steps below the subject, e.g. ["thead", "tr"] or a role group's member classes. */
  chain?: readonly string[];
  /** Conditions on the last compound, each a constant fragment such as ":hover". */
  conditions?: readonly string[];
  ancestor?: { className: string; condition: string };
  pseudoElement?: string;
}

export interface StyleIrRule {
  bucket: number;
  tier: StyleRuleTier;
  selector: StyleSelector;
  declarations: CssDeclaration[];
  /** An @media condition (default presentations only today). */
  media?: string;
}

export type StyleDiagnosticSeverity = "error" | "warning" | "info";

/** Every code is also an export diagnostic code (ExportDiagnosticCode). */
export type StyleDiagnosticCode =
  | "invalid-css-value"
  | "invalid-color"
  | "invalid-font-family"
  | "style-compile-failed"
  | "style-target-not-rendered";

export interface StyleDiagnostic {
  nodeId: string;
  severity: StyleDiagnosticSeverity;
  code: StyleDiagnosticCode;
  message: string;
  property?: string;
}

export interface NodeStyleIR {
  nodeId: string;
  nodeClass: string;
  innerClass?: string;
  rules: StyleIrRule[];
  /** Keyframes definitions this node's rules reference (none can be authored before BC-17.11). */
  keyframeRefs: string[];
  /** Document counter definitions this node's styling references. */
  counterRefs: string[];
  /** SVG <defs> output contract (Report 3 §7.1); empty until BC-17.18. */
  svgDefs: readonly never[];
  diagnostics: StyleDiagnostic[];
  /** Whether any rule has an authored transition (the export's reduced-motion block lists these selectors). */
  hasTransition: boolean;
}
