import type { CssDeclaration, DocumentDefaultStyle } from "@/features/canvas/types/documentDefaultStyle";

// Tailwind v4 theme colors, copied verbatim from tailwindcss/theme.css so
// exported pages paint the exact same oklch() values the Canvas does.
const ZINC_50 = "oklch(98.5% 0 0)";
const ZINC_100 = "oklch(96.7% 0.001 286.375)";
const ZINC_200 = "oklch(92% 0.004 286.32)";
const ZINC_500 = "oklch(55.2% 0.016 285.938)";
const ZINC_600 = "oklch(44.2% 0.017 285.786)";
const ZINC_900 = "oklch(21% 0.006 285.885)";
const ZINC_950 = "oklch(14.1% 0.005 285.823)";
const BLUE_600 = "oklch(54.6% 0.245 262.881)";
const WHITE = "#fff";

/** Tailwind's default `font-sans` stack — the page sheet's font, never the editor's Inter. */
export const DOCUMENT_SANS_FONT_STACK =
  "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";

const TEXT_SM: readonly CssDeclaration[] = [
  ["font-size", "0.875rem"],
  ["line-height", "calc(1.25 / 0.875)"],
];

/**
 * Every default presentation a document element receives on the Canvas
 * when the authored field that would replace it is unset — the single
 * source of truth for both the Canvas (`classes`) and HTML/CSS export
 * (`declarations`). Element style recipes (elementStyleRecipes.ts) decide
 * which ids apply to a node; nothing else should spell these classes.
 *
 * Order matters: export prints one rule per id in this order, and a later
 * rule must win wherever two ids applied to the same element set the same
 * property (table-header-cell after table-cell), matching Tailwind's own
 * utility ordering on the Canvas. `dark:` variants are kept in `classes`
 * for byte-identical Canvas markup but never apply inside the document
 * surface (see globals.css), so they have no declarations.
 */
export const DOCUMENT_DEFAULT_STYLES = {
  "page-surface": {
    classes: "bg-white font-sans text-zinc-950 scheme-light",
    declarations: [
      ["background-color", WHITE],
      ["font-family", DOCUMENT_SANS_FONT_STACK],
      ["color", ZINC_950],
      ["color-scheme", "light"],
    ],
  },
  "page-root": {
    classes: "flex flex-col",
    declarations: [
      ["display", "flex"],
      ["flex-direction", "column"],
    ],
  },
  "legacy-body": {
    classes: "flex flex-col gap-8 p-10 sm:p-14",
    declarations: [
      ["display", "flex"],
      ["flex-direction", "column"],
      ["gap", "2rem"],
      ["padding", "2.5rem"],
    ],
    media: { query: "(width >= 40rem)", declarations: [["padding", "3.5rem"]] },
  },
  "container-radius": {
    classes: "rounded-lg",
    declarations: [["border-radius", "0.5rem"]],
  },
  "container-border": {
    classes: "border border-zinc-100 dark:border-zinc-900",
    declarations: [
      ["border-style", "solid"],
      ["border-width", "1px"],
      ["border-color", ZINC_100],
    ],
  },
  "container-flow": {
    classes: "flex flex-col items-start gap-4",
    declarations: [
      ["display", "flex"],
      ["flex-direction", "column"],
      ["align-items", "flex-start"],
      ["gap", "1rem"],
    ],
  },
  "container-padding": {
    classes: "p-8",
    declarations: [["padding", "2rem"]],
  },
  "list-disc": {
    classes: "list-disc list-inside",
    declarations: [
      ["list-style-position", "inside"],
      ["list-style-type", "disc"],
    ],
  },
  "list-decimal": {
    classes: "list-decimal list-inside",
    declarations: [
      ["list-style-position", "inside"],
      ["list-style-type", "decimal"],
    ],
  },
  heading: {
    classes: "text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50",
    declarations: [
      ["font-size", "1.875rem"],
      ["line-height", "calc(2.25 / 1.875)"],
      ["font-weight", "600"],
      ["letter-spacing", "-0.025em"],
      ["color", ZINC_900],
    ],
  },
  paragraph: {
    classes: "text-base leading-relaxed text-zinc-600 dark:text-zinc-400",
    declarations: [
      ["font-size", "1rem"],
      ["line-height", "1.625"],
      ["color", ZINC_600],
    ],
  },
  "paragraph-prose": {
    classes: "max-w-prose",
    declarations: [["max-width", "65ch"]],
  },
  "list-item": {
    classes: "text-base text-zinc-600 dark:text-zinc-400",
    declarations: [
      ["font-size", "1rem"],
      ["line-height", "calc(1.5 / 1)"],
      ["color", ZINC_600],
    ],
  },
  button: {
    classes:
      "inline-flex w-fit items-center justify-center bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900",
    declarations: [
      ["display", "inline-flex"],
      ["width", "fit-content"],
      ["align-items", "center"],
      ["justify-content", "center"],
      ["background-color", ZINC_900],
      ["padding-inline", "1rem"],
      ["padding-block", "0.5rem"],
      ...TEXT_SM,
      ["font-weight", "500"],
      ["color", WHITE],
    ],
  },
  "control-radius": {
    classes: "rounded-md",
    declarations: [["border-radius", "0.375rem"]],
  },
  "button-shadow": {
    classes: "shadow-sm",
    declarations: [["box-shadow", "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"]],
  },
  // No `w-fit` (removed in Checkpoint 1.15.6.10.3): inline-block already
  // shrink-wraps, and an explicit width: fit-content defeated align-self:
  // stretch for a link inside a stretching Flex parent.
  link: {
    classes: "inline-block text-blue-600 dark:text-blue-400",
    declarations: [
      ["display", "inline-block"],
      ["color", BLUE_600],
    ],
  },
  "link-underline": {
    classes: "underline underline-offset-2",
    declarations: [
      ["text-decoration-line", "underline"],
      ["text-underline-offset", "2px"],
    ],
  },
  "image-frame": {
    classes: "flex w-full items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-900",
    declarations: [
      ["display", "flex"],
      ["width", "100%"],
      ["align-items", "center"],
      ["justify-content", "center"],
      ["overflow", "hidden"],
      ["background-color", ZINC_50],
    ],
  },
  "media-frame": {
    classes: "w-full overflow-hidden bg-zinc-50 dark:bg-zinc-900",
    declarations: [
      ["width", "100%"],
      ["overflow", "hidden"],
      ["background-color", ZINC_50],
    ],
  },
  "media-height": {
    classes: "h-40",
    declarations: [["height", "10rem"]],
  },
  "audio-height": {
    classes: "h-13.5",
    declarations: [["height", "3.375rem"]],
  },
  "media-placeholder-border": {
    classes: "border border-dashed border-zinc-200 dark:border-zinc-800",
    declarations: [
      ["border-style", "dashed"],
      ["border-width", "1px"],
      ["border-color", ZINC_200],
    ],
  },
  "toggle-input": {
    classes: "size-4",
    declarations: [
      ["width", "1rem"],
      ["height", "1rem"],
    ],
  },
  "text-control": {
    classes: "h-9 w-full min-w-0 bg-white px-3 text-sm text-zinc-900 outline-none dark:bg-zinc-950 dark:text-zinc-100",
    declarations: [
      ["height", "2.25rem"],
      ["width", "100%"],
      ["min-width", "0"],
      ["background-color", WHITE],
      ["padding-inline", "0.75rem"],
      ...TEXT_SM,
      ["color", ZINC_900],
      ["outline-style", "none"],
    ],
  },
  textarea: {
    classes:
      "h-24 w-full min-w-0 resize-none bg-white px-3 py-2 text-sm text-zinc-900 outline-none dark:bg-zinc-950 dark:text-zinc-100",
    declarations: [
      ["height", "6rem"],
      ["width", "100%"],
      ["min-width", "0"],
      ["resize", "none"],
      ["background-color", WHITE],
      ["padding-inline", "0.75rem"],
      ["padding-block", "0.5rem"],
      ...TEXT_SM,
      ["color", ZINC_900],
      ["outline-style", "none"],
    ],
  },
  "control-border": {
    classes: "border border-zinc-200 dark:border-zinc-800",
    declarations: [
      ["border-style", "solid"],
      ["border-width", "1px"],
      ["border-color", ZINC_200],
    ],
  },
  table: {
    classes: "border-collapse text-sm text-zinc-900 dark:text-zinc-100",
    declarations: [["border-collapse", "collapse"], ...TEXT_SM, ["color", ZINC_900]],
  },
  "table-cell": {
    classes: "px-3 py-2 text-left align-top text-sm text-zinc-600 dark:text-zinc-400",
    declarations: [
      ["padding-inline", "0.75rem"],
      ["padding-block", "0.5rem"],
      ["text-align", "left"],
      ["vertical-align", "top"],
      ...TEXT_SM,
      ["color", ZINC_600],
    ],
  },
  "table-header-cell": {
    classes: "font-medium text-zinc-900 dark:text-zinc-100",
    declarations: [
      ["font-weight", "500"],
      ["color", ZINC_900],
    ],
  },
  caption: {
    classes: "px-3 py-2 text-left text-sm text-zinc-600 dark:text-zinc-400",
    declarations: [
      ["padding-inline", "0.75rem"],
      ["padding-block", "0.5rem"],
      ["text-align", "left"],
      ...TEXT_SM,
      ["color", ZINC_600],
    ],
  },
  legend: {
    classes: "text-sm font-medium text-zinc-900 dark:text-zinc-50",
    declarations: [...TEXT_SM, ["font-weight", "500"], ["color", ZINC_900]],
  },
  figcaption: {
    classes: "text-sm text-zinc-500 dark:text-zinc-400",
    declarations: [...TEXT_SM, ["color", ZINC_500]],
  },
  "divider-border": {
    classes: "border-zinc-200 dark:border-zinc-800",
    declarations: [["border-color", ZINC_200]],
  },
  "svg-width": {
    classes: "w-50",
    declarations: [["width", "12.5rem"]],
  },
  "svg-height": {
    classes: "h-50",
    declarations: [["height", "12.5rem"]],
  },
  dialog: {
    classes: "max-w-none bg-white p-8 text-zinc-900 backdrop:bg-black/40 dark:bg-zinc-950 dark:text-zinc-50",
    declarations: [
      ["max-width", "none"],
      ["background-color", WHITE],
      ["padding", "2rem"],
      ["color", ZINC_900],
    ],
    backdrop: [["background-color", "color-mix(in oklab, #000 40%, transparent)"]],
  },
} as const satisfies Record<string, DocumentDefaultStyle>;

export type DocumentDefaultStyleId = keyof typeof DOCUMENT_DEFAULT_STYLES;

function isDocumentDefaultStyleId(key: string): key is DocumentDefaultStyleId {
  return key in DOCUMENT_DEFAULT_STYLES;
}

/** Ids in table order — the order export prints their rules in. */
export const DOCUMENT_DEFAULT_STYLE_IDS: readonly DocumentDefaultStyleId[] =
  Object.keys(DOCUMENT_DEFAULT_STYLES).filter(isDocumentDefaultStyleId);

export function getDocumentDefaultStyle(id: DocumentDefaultStyleId): DocumentDefaultStyle {
  return DOCUMENT_DEFAULT_STYLES[id];
}

/** The Canvas class string for a list of default ids, joined in the given order. */
export function documentDefaultClasses(ids: readonly DocumentDefaultStyleId[]): string {
  return ids.map((id) => DOCUMENT_DEFAULT_STYLES[id].classes).join(" ");
}
