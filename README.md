# Layoutry

**Build layouts visually. Own the code.**

Layoutry is a browser-based visual HTML & CSS editor. It lets you build real web page layouts by selecting elements on a live-rendered canvas and adjusting their styling through a visual Inspector — spacing, typography, backgrounds, borders, layout, and more — instead of hand-writing markup and CSS from scratch.

It's aimed at anyone who wants to construct a page visually using real HTML and CSS concepts: beginners and students learning how layout works, designers exploring ideas, and frontend developers who want a faster, visual way to build interfaces.

## What is Layoutry?

Every page you build in Layoutry is represented internally as a typed document model — not raw HTML strings, not an iframe, not a `contentEditable` region. The Canvas, the Structure panel, and the Inspector all read from and write to that same model, which keeps the whole editor consistent and gives every change a real undo/redo history.

Reusable pieces (buttons, cards, navbars, forms, and so on) are not a separate, opaque component system — they're pre-assembled compositions of the same ordinary HTML primitives (containers, headings, paragraphs, links, images, buttons) you can insert and edit individually. Once inserted, a component behaves exactly like anything you built by hand: every element inside it is a normal node in the document tree, editable like any other.

## Current Status

Layoutry is under active development. The visual editing foundation — the Canvas, the document model, the Inspector, layout systems, a substantial HTML primitive and component library, and a generic interaction system with a live Preview mode — is functional today. Source-code export, backend/account features, and production hardening are not implemented yet; see [Roadmap](#roadmap).

## Core Features

### Visual Editor

- A live-rendered Canvas that shows the document exactly as it will appear, with click-to-select, resize handles, and drag-to-move.
- Single and multi-element selection, with compatible style operations applicable across the whole selection at once.
- A Structure panel showing the full element tree, for selecting and navigating elements directly.
- Undo/redo, available from the toolbar, the Edit menu, and keyboard shortcuts, all backed by the same history.
- A Design/Preview toggle: Design mode is always fully editable; Preview mode renders the page as a visitor would experience it, including real interactive behavior (see [Interactions & Preview](#interactions--preview)).
- A "Free" layout mode for absolute positioning within a container, with alignment-guide snapping against parent and sibling edges while dragging.

### Layout & CSS

Any container can be arranged as normal document flow, a Flexbox container, or a CSS Grid container, configured visually through the Inspector. Elements support sizing (width/height, min/max constraints), spacing (margin/padding), CSS position (relative/absolute/fixed and offsets), aspect ratio, and overflow.

The Inspector exposes visual controls for a growing set of commonly used CSS properties, including:

- Typography (font family, size, weight, style, color, alignment, line height, letter spacing, text decoration)
- Backgrounds, including gradients
- Borders and border radius
- Box shadows
- Visual effects/filters and opacity
- Display, visibility, and overflow
- Image/video fit and positioning (`object-fit` / `object-position`)
- Flex-item and Grid-item placement for a selected child

This is not full CSS coverage — it's a deliberately curated, visual subset of the properties people reach for most often.

A container can also protect its descendants' styling from accidental edits ("lock child styles") while still allowing content and structural changes underneath it.

### HTML Elements

A substantial set of real HTML primitives can be inserted directly, including:

- Structural: Container (`div`), Section, Header, Nav, Main, Article, Aside, Footer
- Text: Heading (`h1`–`h6`), Paragraph, Link
- Lists: Unordered List, Ordered List, List Item
- Tables: a full Table with header/body/footer rows and cells
- Forms: Form, Label, text-like Inputs (text/email/password/number/search/url/tel), Textarea, Select with Options, Checkbox, Radio
- Media: Image, Video, an embeddable iframe, SVG
- Interactive: Button, and a native `<dialog>` element
- Buttons and native dialogs are rendered using the real browser elements, not editor-only stand-ins

### Components

Ready-made compositions, built entirely from the primitives above, currently include:

- **Buttons** — Primary, Secondary, Outline, Ghost, Button Group, Dropdown Button
- **Navigation** — Basic Navbar, Navbar with CTA, Centered Navbar, Breadcrumbs, Pagination, Sidebar Navigation
- **Cards** — Basic, Image, Horizontal, Profile, Feature, Pricing
- **Forms** — Labeled Text Field, Search Bar, Newsletter Signup, Contact Form, Login Form, Labeled Select Field
- **Data Display** — Badge, Avatar, Avatar with Text, Stat Card, Metadata Row
- **Interactive** — Collapsible, Modal

Once inserted, a component is indistinguishable from hand-assembled primitives — there's no special "component mode" to edit it in.

### SVG & Shapes

A basic SVG primitive can be inserted with a starter shape (rectangle, circle, or similar) and its own fill/stroke. A separate SVG Drawing mode allows constructing a small vector scene from basic shape objects directly on the canvas. This is a focused drawing foundation, not a full vector illustration tool.

Separately, containers support a small set of CSS `clip-path` shape presets ("Advanced Shapes") for non-rectangular container silhouettes.

### Interactions & Preview

Elements can be given a simple click interaction: **on click, show / hide / toggle** another element. This generic mechanism — not special-cased per component — is what powers Collapsible, Dropdown Button, and Modal. Modal specifically uses a real native `<dialog>` element with the browser's own `showModal()`/`close()` lifecycle, rather than a fake overlay.

Interactions only run in **Preview mode** — a one-click toggle that renders the page in its "live" state so you can click through the behavior you've authored, then return to editing.

Interactions are currently limited to click-triggered show/hide/toggle. Hover triggers, timers, animation, and conditional logic are not implemented.

## Architecture Philosophy

```
HTML primitives  →  Reusable compositions/components  →  Pages
```

Components are never a proprietary node type — they're ordinary primitives assembled together at creation time. A Card is a Container with a Heading, a Paragraph, and a Link inside it; nothing distinguishes it from one you built by hand once it's on the canvas. Interactive components (Dropdown, Collapsible, Modal) are built on the same generic click/show/hide/toggle mechanism every element has access to, not bespoke per-component runtime state.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript (strict mode)
- **UI:** React
- **Styling:** Tailwind CSS
- **State management:** Zustand
- **Drag & drop:** dnd-kit
- **Validation:** Zod
- **Icons:** lucide-react
- **Testing:** Vitest + React Testing Library (unit/component), Playwright (browser end-to-end), axe-core (accessibility checks)
- **Linting/formatting:** ESLint, Prettier

## Getting Started

```bash
git clone https://github.com/AlexanderYovchev/layoutry.git
cd layoutry
npm install
npm run dev
```

The dev server runs at `http://localhost:3000`.

**Prerequisites:** Node.js (current LTS or newer) and npm.

## Development

```bash
npm run build          # production build
npm run start           # run the production build
npm run lint             # ESLint
npm run typecheck         # TypeScript, no emit
npm run format             # Prettier, write
npm run format:check        # Prettier, check only
```

## Testing

```bash
npm run test         # unit/component tests (Vitest + React Testing Library)
npm run test:watch   # unit/component tests in watch mode
npm run test:e2e      # browser end-to-end tests (Playwright)
```

The project has extensive Vitest coverage across the document model, layout resolvers, and Inspector, plus Playwright end-to-end tests (including automated accessibility checks) that exercise real browser behavior the way a person would use the app.

## Roadmap

Implemented today:

- Visual Canvas, selection (single and multi), drag/resize, undo/redo
- Typed document model with a Structure panel
- Flow, Flexbox, Grid, and Free (absolute) layout, with alignment snapping
- A curated visual CSS Inspector (typography, background, borders, shadows, effects, display, position, media fit)
- A substantial HTML primitive library and a components library across Buttons, Navigation, Cards, Forms, Data Display, and Interactive families
- A generic click → show/hide/toggle interaction system with a Design/Preview toggle
- An SVG primitive, a small SVG Drawing mode, and CSS clip-path shape presets
- Parent-level style protection

Planned:

- Remaining component families (e.g. Toast, Tooltip, Tabs, Drawer)
- Additional HTML/media primitives
- A source-code export engine (HTML/CSS, with framework-oriented output such as Tailwind, React, or Vue under consideration)
- Accounts, cloud-saved projects, and related backend infrastructure
- A subscription tier for advanced/export capabilities
- Animation tooling
- AI-assisted editing
- Production hardening ahead of a public release

## Contributing

Layoutry's editor architecture (the document model, feature boundaries, and dependency rules between them) is deliberate and actively relied on — see [CLAUDE.md](./CLAUDE.md) and [docs/architecture/](./docs/architecture/) for the full ownership and dependency rules. If you're contributing:

- Keep changes focused and scoped to the task at hand rather than opportunistic refactors.
- Preserve existing architectural boundaries (what each feature owns, what it must not depend on).
- Include tests for behavior changes — the project relies on its Vitest/Playwright coverage to catch regressions.

## License

This is proprietary, closed-source software. All rights reserved. No license is granted for use, modification, or distribution without explicit written permission from the repository owner.
