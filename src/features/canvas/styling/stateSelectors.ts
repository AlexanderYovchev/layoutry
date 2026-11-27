import {
  STYLE_BUCKET,
  type StyleSurface,
} from "@/features/canvas/styling/styleIr";
import type {
  StateAtom,
  StyleCondition,
} from "@/features/editor/types/styleRules";

/*
 * BC-17.3 — state atom → selector mapping (BC-17.1.3 Report 1 §6.10) and
 * Design safety (§6.8). The mapping is per atom (and, for "open" and
 * "indeterminate", per element), never per surface, so Design, Preview
 * and Export match the same elements.
 *
 * Design never lets the REAL pointer or focus restyle a document while it
 * is edited: interaction atoms compile ONLY to the editor's forced form
 * [data-ly-force~="<atom>"] there (set by state simulation, BC-17.5).
 * Document-attribute atoms (disabled, checked…) describe authored content,
 * so Design shows them truthfully and can also force them. Preview and
 * Export use the real selectors only; data-ly-force never reaches them.
 */

/** Atoms the browser derives from interaction (or runtime UI state). */
const INTERACTION_ATOMS: ReadonlySet<StateAtom> = new Set([
  "hover",
  "focus",
  "focus-visible",
  "focus-within",
  "active",
  "open",
  "expanded",
  "selected",
]);

export function isInteractionAtom(atom: StateAtom): boolean {
  return INTERACTION_ATOMS.has(atom);
}

function realSelector(
  atom: StateAtom,
  element: { tag: string; customProgress: boolean },
): string {
  switch (atom) {
    case "disabled":
      // Design buttons are aria-disabled (a native disabled button can't be
      // selected), Preview/Export buttons natively disabled, disabled links
      // aria-disabled everywhere, native controls :disabled.
      return ':is(:disabled, [aria-disabled="true"])';
    case "current":
      return '[aria-current]:not([aria-current="false"])';
    case "expanded":
      return '[aria-expanded="true"]';
    case "selected":
      return '[aria-selected="true"]';
    case "open":
      return element.tag === "dialog" ? "[open]" : '[data-state="open"]';
    case "indeterminate":
      return element.customProgress
        ? '[data-state="indeterminate"]'
        : ":indeterminate";
    default:
      return `:${atom}`;
  }
}

/** The forced (Design state simulation) form of an atom. */
export function forcedSelector(atom: StateAtom): string {
  return `[data-ly-force~="${atom}"]`;
}

/** The selector fragment one atom compiles to on a surface. */
export function atomSelector(
  atom: StateAtom,
  surface: StyleSurface,
  element: { tag: string; customProgress: boolean },
): string {
  const real = realSelector(atom, element);
  if (surface !== "design") return real;
  return isInteractionAtom(atom)
    ? forcedSelector(atom)
    : `:is(${real}, ${forcedSelector(atom)})`;
}

/** The global bucket a condition sorts into (Report 1 §6.4). */
export function conditionBucket(condition: StyleCondition): number {
  const self = condition.self ?? [];
  if (self.length >= 2 || (self.length === 1 && condition.ancestor))
    return STYLE_BUCKET.compound;
  if (self.length === 1) return STYLE_BUCKET[self[0]];
  if (condition.ancestor) return STYLE_BUCKET.ancestor;
  return STYLE_BUCKET.base;
}
