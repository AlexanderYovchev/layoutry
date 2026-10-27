# Testing Strategy

## Where tests live

- **Unit and component tests** (Vitest + React Testing Library) are
  colocated with the module they test wherever practical — e.g.
  `src/components/layout/AppHeader.tsx` sits next to
  `src/components/layout/AppHeader.test.tsx`. Colocation keeps a feature's
  tests moving with it if the feature is later restructured or extracted.
- **Shared test configuration** lives under `test/` (currently
  `test/setup.ts`, the Vitest + jest-dom setup loaded via
  `vitest.config.ts`). Configuration that applies across the whole test
  suite belongs here, not duplicated per feature.
- **Shared fixtures** used by both `src/` and `desktop/` tests live under
  `test/fixtures/`. `test/fixtures/persistence/` holds byte-exact data
  written by earlier checkpoints (PROJECT-1.5). It is never regenerated or
  reformatted (`.gitattributes` and `.prettierignore` protect it).
- `test/fixtures/export/` holds the authored documents the HTML/CSS export
  fidelity tests share: the jsdom Canvas/export parity test, the export
  unit tests, and the Playwright visual parity spec (EXPORT-1.2 — see
  [export-engine.md](./export-engine.md#visual-parity-testing)).
- **End-to-end tests** (Playwright) live under `e2e/`, never colocated with
  source. E2E specs exercise the built application through a real browser
  and belong together regardless of which feature they touch.

## What to test

- Test observable behavior — what a user or caller can see or depend on —
  not internal implementation details. A test should still pass after a
  refactor that doesn't change behavior.
- Add tests for meaningful behavior, not placeholders or tests that assert
  trivial framework behavior. A test that always passes regardless of the
  implementation is worse than no test.
- Once the document model exists (see
  [editor-domain-model.md](./editor-domain-model.md)), prefer testing
  editor commands and model mutations directly over driving them through
  simulated DOM interactions — plain-data testing is faster and more
  precise than DOM-level testing for logic that doesn't need a browser.

## Required checks

All of the following must pass before a task is considered complete:

```
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run test:e2e` should be run when a change affects application
execution (routing, rendering, user-visible behavior) or when it is
otherwise quick to run in the current environment. It downloads a browser
binary on first run in a fresh environment, so it is not always cheap to
run for documentation-only changes.
