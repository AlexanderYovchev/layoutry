# Layoutry Claude Instructions

## Project Identity

- **Product name:** Layoutry
- **Tagline:** Build layouts visually. Own the code.
- **Product purpose:** Layoutry is a browser-based visual HTML and CSS
  editor. Users visually build responsive interfaces, edit styling through
  an inspector, and export clean, production-ready code.
- **Current development stage:** Technical foundation only. Next.js App
  Router + TypeScript strict + Tailwind CSS + Zustand + dnd-kit + Zod +
  Vitest/RTL + Playwright + ESLint + Prettier are in place and passing. No
  editor functionality (canvas rendering, selection, drag-and-drop,
  inspector, export) has been implemented yet — see
  [docs/roadmap/milestones.md](docs/roadmap/milestones.md) for sequencing.

## Claude's Role

Claude acts as the **implementation engineer**. Claude must:

- Inspect existing architecture before coding — read the relevant feature
  directory and this file before assuming how something should be built.
- Follow the documented ownership boundaries in this file and in
  [docs/architecture/](docs/architecture/).
- Make focused changes scoped to the current task.
- Avoid unrelated refactors, even when a "better" pattern is spotted along
  the way — raise it instead of doing it silently.
- Preserve existing behavior unless a change to it is the explicit task.
- Run relevant validation commands (see Completion Checklist) before
  reporting a task complete.
- Report which files were changed.
- Never commit or push unless explicitly instructed for that action, in
  that conversation.

## Source of Truth

When guidance conflicts, this is the order of authority:

1. The current task prompt
2. This file (`CLAUDE.md`)
3. [docs/architecture/](docs/architecture/)
4. [docs/decisions/](docs/decisions/)
5. [docs/roadmap/](docs/roadmap/)
6. The existing, tested implementation

**If instructions conflict, stop and report the conflict rather than
silently choosing one.** For example, if the task prompt asks for something
that contradicts a dependency rule below, say so and ask how to proceed
instead of picking a side unilaterally.

## Architecture Rules

- `src/app` owns routes, layouts, metadata, and route composition. It must
  not contain the editor's domain logic.
- `src/features` owns product features. Each feature owns its components,
  hooks, stores, types, schemas, utilities, and tests where applicable.
- `src/components/ui` owns generic, reusable UI primitives.
- `src/components/layout` owns application-shell layout components.
- `src/lib` owns shared, framework-independent utilities and integrations.
- `src/styles` owns global design tokens and shared styling infrastructure.
- Feature-specific code must remain inside the feature that owns it.
- Cross-feature imports must use a feature's stable public API
  (`index.ts`) rather than deep internal imports, where practical.
- Shared code must not be extracted until it is genuinely shared by more
  than one consumer.
- Do not create catch-all files such as `helpers.ts`, `common.ts`, or
  `misc.ts`.
- Prefer small, focused files with descriptive names.
- Avoid circular dependencies.
- Avoid placing business logic inside React presentation components.

Full detail: [docs/architecture/repository-structure.md](docs/architecture/repository-structure.md).

### Feature ownership

**editor** — owns: the complete editable document, editor commands,
history and undo/redo, selected element identity, project-wide editor
state, document mutations, orchestration between canvas and inspector.
Must not own: visual rendering implementation, inspector control
presentation, code formatting implementation.

**canvas** — owns: visual rendering of the document model, selection
outlines, drag interactions, resize interactions, zoom and pan, snapping
and alignment guides, canvas coordinate calculations. Must not own:
persistence, subscriptions, generated source-code formatting, inspector
form state.

**inspector** — owns: property-control UI, CSS property grouping,
validation of inspector input, translating user input into editor
commands, mixed-value and multi-selection presentation. Must not directly
mutate canvas DOM as its source of truth.

**components-library** — owns: reusable element definitions, component
metadata, default props and styles, categories, insertion definitions,
future template definitions. Must not own: canvas interaction mechanics,
persistence, billing.

**export** — owns: HTML generation, CSS generation, future Tailwind
generation, formatting, optimization, output validation, deterministic
source generation. Must consume the typed document model and must not
scrape rendered DOM as its primary export method.

**components/ui** — owns generic application primitives (Button, Input,
Select, Tabs, Tooltip, Dialog, etc.). Must not contain editor-specific
domain behavior.

**components/layout** — owns the app header, sidebars, application shell,
panels, status bar, and responsive shell structure.

## Dependency Direction

- `app` may import components, features, lib, and styles.
- layout components may import shared UI and lib.
- features may import shared UI, lib, and their own internal files.
- shared UI must not import product features.
- lib must not import product features.
- One feature must not directly mutate another feature's internal state.

Full detail, including rationale: [docs/architecture/dependency-rules.md](docs/architecture/dependency-rules.md).

## Editor Architecture Principle

The future editor must use a **typed, serializable document model** as its
source of truth. The rendered canvas must not become the authoritative
state. Do not build the editor around arbitrary direct DOM mutation.

Future document data must be suitable for: persistence, undo and redo,
export, validation, migration, collaboration, and testing.

Full detail: [docs/architecture/editor-domain-model.md](docs/architecture/editor-domain-model.md).

## File Placement Rules

| Kind                                    | Location                                         |
| --------------------------------------- | ------------------------------------------------ |
| Routes, layouts, metadata               | `src/app/`                                       |
| Page components                         | `src/app/` (composing feature/shared components) |
| Feature components                      | `src/features/<feature>/components/`             |
| Shared UI primitives                    | `src/components/ui/`                             |
| Application-shell components            | `src/components/layout/`                         |
| Feature-specific hooks                  | `src/features/<feature>/hooks/`                  |
| Feature-specific stores                 | `src/features/<feature>/stores/`                 |
| Feature-specific types                  | `src/features/<feature>/types/`                  |
| Zod schemas                             | `src/features/<feature>/schemas/`                |
| Feature-specific utilities              | `src/features/<feature>/utils/`                  |
| Shared, framework-independent utilities | `src/lib/`                                       |
| Unit/component tests                    | Colocated with the module under test             |
| Shared test configuration               | `test/`                                          |
| Playwright end-to-end tests             | `e2e/`                                           |
| Architecture documentation              | `docs/architecture/`                             |
| Architectural decisions                 | `docs/decisions/` (ADR format)                   |
| Roadmap                                 | `docs/roadmap/`                                  |
| Point-in-time session/setup reports     | `docs/reports/`                                  |
| Superseded documentation                | `docs/archive/`                                  |
| Saved successful Claude prompts         | `docs/prompts/`                                  |
| Application UI design references        | `docs/ui/`                                       |
| Static assets served as-is              | `public/`                                        |
| Generated files                         | Never committed — see Git Safety Rules           |

Do not create a feature subfolder, `index.ts`, or documentation folder
ahead of having real content for it — see
[docs/architecture/dependency-rules.md](docs/architecture/dependency-rules.md#do-not-pre-scaffold).

## Testing Rules

- Colocate unit/component tests with the module being tested when
  practical.
- Keep shared test configuration under `test/`.
- Keep browser-level tests under `e2e/`.
- Test observable behavior rather than implementation details.
- Add tests for meaningful behavior, not placeholders.
- All relevant checks must pass before a task is considered complete.

Full detail: [docs/architecture/testing-strategy.md](docs/architecture/testing-strategy.md).

## Styling Rules

- Use Tailwind for application styling.
- Use the existing `cn()` helper (`src/lib/utils.ts`) for class
  composition.
- Do not use arbitrary inline styles for the application interface unless
  runtime-calculated values genuinely require them.
- Distinguish between Layoutry's own UI styles (design tokens in
  `src/styles/`, application chrome) and styles representing user-created
  canvas documents (generated by the `export` feature from the document
  model). Do not mix editor UI design tokens with generated user-document
  styles — they serve different consumers and must not leak into each
  other.

## TypeScript Rules

- Maintain strict typing (`tsconfig.json` already has `strict: true` — do
  not weaken it).
- Avoid `any`.
- Prefer `unknown` followed by validation over an unchecked assumption.
- Use discriminated unions for editor node types where appropriate.
- Validate persisted and external data with Zod.
- Do not duplicate domain types across features — a type owned by one
  feature should be imported, not redefined, by another.
- Do not use type assertions (`as`) to hide unresolved typing problems.

## Git Safety Rules

- Do not commit, push, rebase, reset, force-push, or modify GitHub
  settings unless explicitly instructed for that specific action.
- Inspect `git diff` before reporting a task complete.
- Never commit secrets, environment variables, generated output, browser
  binaries, or dependency folders.
- Do not rewrite Git history.

## Completion Checklist

At the end of a task, report:

1. Summary
2. Files created
3. Files modified
4. Files moved
5. Files deleted
6. Commands run
7. Validation results
8. Unresolved risks
9. Recommended commit message
