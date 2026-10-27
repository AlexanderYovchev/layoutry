/** One CSS declaration in CSS-text form: a hyphenated property and its value. */
export type CssDeclaration = readonly [property: string, value: string];

/**
 * One default presentation the Canvas applies to a document element when
 * the corresponding authored field is unset (EXPORT-1.2). `classes` is
 * what the Canvas renders; `declarations` is the exact plain-CSS
 * equivalent the export emits. Both live in one entry so the two can
 * never drift apart — documentDefaultStyles.test.ts compiles `classes`
 * with the repo's own Tailwind and checks it against `declarations`.
 */
export interface DocumentDefaultStyle {
  /** Tailwind classes applied on the Canvas, in the exact order the element component always used. */
  readonly classes: string;
  readonly declarations: readonly CssDeclaration[];
  /** Declarations that only apply inside a viewport media query (a responsive Tailwind variant). */
  readonly media?: { readonly query: string; readonly declarations: readonly CssDeclaration[] };
  /** Declarations for the element's own `::backdrop` (dialog only). */
  readonly backdrop?: readonly CssDeclaration[];
}
