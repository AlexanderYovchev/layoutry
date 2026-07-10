# Layoutry

**Build layouts visually. Own the code.**

Layoutry is a professional visual HTML & CSS editor that enables developers and designers to build responsive interfaces visually while generating clean, production-ready code. It lets users select elements on a page — text, containers, buttons, and more — and adjust their styling in real time through an intuitive CSS control panel, without writing a single line of code by hand.

## Vision

Not everyone who wants to design a web page knows CSS, and not everyone who knows CSS wants to write it from scratch for every experiment. Layoutry bridges that gap: it works like a drawing tool, but instead of a canvas and a drawing toolbar, it gives you a live-rendered page and a toolbar of CSS controls.

The core workflow:

1. Open the tool in your browser — no installation required.
2. Select one or more HTML elements on the page (text, containers, buttons, etc.).
3. A contextual CSS panel appears above the selection, exposing the relevant properties — spacing, sizing, color, typography, z-index, and more.
4. Adjust values with sliders, pickers, and inputs, and watch the page update instantly.
5. When satisfied, export or copy the generated HTML/CSS source code (available to subscribed users).

Layoutry is aimed at anyone who wants to explore and refine a page's look and feel before committing to code — designers prototyping ideas, developers iterating quickly, and non-technical users who just want to see "what if."

## Product Principles

- **Real-time feedback** — every style change renders immediately, with no build step or page reload.
- **No prior CSS knowledge required** — the interface exposes CSS concepts through familiar, visual controls.
- **Code you can trust** — the HTML/CSS generated behind the scenes is clean and exportable, not a black box.
- **Freemium by design** — anyone can experiment freely; exporting production-ready source code is a subscription feature.

## Status

Layoutry has a working technical foundation: a Next.js App Router application with TypeScript, Tailwind CSS, linting, formatting, and a test suite are all in place and passing. **The editor itself — canvas, element selection, style inspector, drag-and-drop, and export — has not yet been implemented.** The current UI is a minimal placeholder shell that confirms the foundation is operational, nothing more.

## Technology Stack

- **Framework:** Next.js (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **UI:** React
- **Styling:** Tailwind CSS
- **State management:** Zustand (installed, not yet wired to any editor state)
- **Drag & drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (installed for future canvas interactions)
- **Validation:** Zod (installed for future project/schema validation)
- **Icons:** lucide-react
- **Class composition:** clsx + tailwind-merge
- **Linting/formatting:** ESLint (Next.js recommended config), Prettier (with prettier-plugin-tailwindcss)
- **Testing:** Vitest + React Testing Library (unit/component), Playwright (end-to-end)
- **Package manager:** npm

## Prerequisites

- Node.js (a current LTS or newer release)
- npm

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Starts the local dev server at `http://localhost:3000`.

## Testing

```bash
npm run test        # unit/component tests (Vitest + React Testing Library)
npm run test:watch  # unit/component tests in watch mode
npm run test:e2e     # end-to-end smoke test (Playwright; downloads a browser binary on first run)
```

## Other commands

```bash
npm run build          # production build
npm run start           # run the production build
npm run lint             # ESLint
npm run typecheck         # TypeScript, no emit
npm run format             # Prettier, write
npm run format:check        # Prettier, check only
```

## Initial Architecture

```
src/
  app/                    Next.js App Router entry (layout, page, global styles)
  components/
    ui/                   Shared UI primitives (empty — none needed yet)
    layout/               Structural layout components (AppHeader)
  features/
    editor/                Editor state/logic (not yet implemented)
    canvas/                 Canvas rendering (not yet implemented)
    inspector/               Style inspector (placeholder only)
    components-library/       Reusable element library (not yet implemented)
    export/                     HTML/CSS export logic (not yet implemented)
  lib/                          Shared utilities (e.g. cn() class helper)
  styles/                        Reserved for future design tokens
test/                              Vitest setup
e2e/                                 Playwright specs
```

The `features/` directories are organized so the eventual editor engine can be introduced cleanly. The long-term plan is for the canvas to render a **typed, serializable document model** as its source of truth — not an iframe, raw HTML string, uncontrolled `contentEditable` region, or direct DOM mutation. That engine is intentionally not implemented yet; only the directory structure and placeholder UI exist at this stage.

## Repository Architecture

Layoutry uses a feature-based architecture: product functionality lives under `src/features/*` (editor, canvas, inspector, components-library, export), each owning its own components, hooks, stores, types, and tests, with explicit rules for what may depend on what.

- [CLAUDE.md](./CLAUDE.md) — the operating manual for Claude Code sessions working in this repo: ownership boundaries, dependency direction, file placement, and safety rules.
- [docs/architecture/README.md](./docs/architecture/README.md) — full architecture documentation: repository structure, dependency rules, the editor's document-model principle, and testing strategy.
- [docs/roadmap/milestones.md](./docs/roadmap/milestones.md) — the milestone sequence this project is working through.

## License

This is proprietary, closed-source software. All rights reserved. No license is granted for use, modification, or distribution without explicit written permission from the repository owner.
