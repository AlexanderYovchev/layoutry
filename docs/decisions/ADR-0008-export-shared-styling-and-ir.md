# ADR-0008: Export Shares the Canvas's Styling Rules Through One IR

**Status:** Accepted

**Date:** 2026-10-27

## Context

The EXPORT-1.1 audit showed two things. First, the authored CSS of every
node already came from pure resolvers in the canvas feature. Second, a large
share of what users see came from somewhere other than the document:

- Tailwind Preflight;
- default Tailwind class strings hardcoded in each element component (for
  example, every heading is `text-3xl font-semibold`);
- fallback classes for unset fields;
- the page sheet's surface.

Each element component also hard-coded which resolvers it applies, in which
order, and when a default class gives way. An exporter that re-implemented
any of this would drift from the Canvas.

Three decisions were approved for EXPORT-1.2:

- **V1:** reuse the Canvas styling through a stable, framework-independent
  API, without duplicating it.
- **V2:** export the authored appearance, including the Canvas defaults
  that are part of the page, but never editor chrome.
- **V3:** two output shapes, standalone and separate, from one IR.

## Decision

- **Shared design rules live in the canvas feature and are exposed by
  `src/features/canvas/index.ts`.** That file exports pure modules only:
  - `documentDefaultStyles.ts`: one table of every Canvas default, each
    pairing its Tailwind `classes` with the exact CSS `declarations` they
    compile to;
  - `elementStyleRecipes.ts`: per element family, resolver order plus
    default selection;
  - the existing resolvers.
- **Canvas components consume the recipes** instead of inlining the
  composition. This was a behavior-neutral refactor: the classes are
  byte-identical and the inline styles are the same objects.
- **Export builds a target-independent IR** (`ExportDocument`) from the
  document by calling the same recipes with Preview semantics. Printers
  turn the IR into HTML and CSS. Both output modes print the same IR and
  the same stylesheet text.
- **Drift is a test failure, not a review burden:**
  - a unit test compiles each default's classes with the repo's Tailwind
    and compares them with its declarations;
  - a jsdom test compares the real Canvas components with the IR node by
    node;
  - a Playwright spec compares rendered pixels, geometry and computed
    styles.
- **Export depends on the project feature only for its limits.** It
  deep-imports `rules/projectLimits` because the project `index.ts` also
  re-exports React components, which a DOM-free generator must not load.

## Consequences

- The Canvas and the export cannot disagree about which CSS a node gets
  without a test failing. A future change to a default class or a resolver
  order flows to the export automatically.
- The Canvas components became smaller. Their remaining logic is
  editor-only: drag state, text editing, event handling.
- Tailwind, React and Vue exporters can read `defaultStyles` and
  `declarations` without re-deriving anything.
- The default table must be updated whenever a Canvas default class
  changes. The compile test enforces this.
- Export reproduces some legacy Canvas defaults that look like editor chrome
  (a container's faint border, the empty-media dashed frame) because they
  are visible on the authored page in Preview. Making them Design-only would
  be a product change to both the Canvas and the export.

## Alternatives considered

- **Export keeps its own per-tag recipe table, guarded by a parity test.**
  Rejected: it duplicates the composition that V1 asked to share. The
  parity test was kept anyway as a second guard.
- **Scrape the rendered Canvas DOM.** Rejected: the document model is the
  source of truth (ADR-0001), and DOM scraping would export editor-only
  state.
- **Ship Tailwind itself with exported pages.** Rejected for plain HTML/CSS:
  the output must not depend on a framework or build step. Tailwind output
  is its own future target.
- **Translate the default classes by hand without a compile check.**
  Rejected: the colors are `oklch()` values and line heights are `calc()`
  ratios, and hand transcription drifts silently.
