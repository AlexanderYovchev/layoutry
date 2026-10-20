# Repository Structure

This document describes where files belong in Layoutry, both as the
repository stands today and as it is expected to grow. The repository root
is the application root — there is no nested app directory.

## Repository root

```
layoutry/
├── .claude/
│   └── settings.local.json      # local, gitignored, machine-specific
├── desktop/                     # Electron desktop shell + Windows packaging (ADR-0002)
├── docs/                        # documentation (see below)
├── e2e/                         # Playwright specs (e2e/desktop/: dev Electron, e2e/packaged/: packaged exe)
├── public/                      # static assets served as-is (created when first asset is added)
├── src/                         # application source (see below)
├── test/                        # shared Vitest setup
├── CLAUDE.md                    # permanent Claude operating manual
├── README.md
├── package.json / package-lock.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── playwright.config.ts
├── playwright.desktop.config.ts # real-Electron suite (npm run desktop:test)
├── playwright.packaged.config.ts # packaged Layoutry.exe suite (npm run desktop:test:packaged)
├── vitest.config.ts
├── .gitignore
├── .prettierignore
└── .prettierrc.json
```

Framework and tooling configuration files stay at the repository root — do
not relocate them into `src/` or elsewhere.

## Source structure (`src/`)

```
src/
├── app/                    # Next.js App Router: routes, layouts, metadata
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── layout/             # application-shell components (AppHeader, etc.)
│   └── ui/                 # generic, product-agnostic UI primitives
│
├── features/                    # product features — see feature ownership below
│   ├── editor/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── types/
│   │   ├── schemas/              # created when the first Zod schema is needed
│   │   ├── utils/
│   │   └── index.ts              # created when there is a stable public API to export
│   │
│   ├── canvas/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/                # created when canvas needs its own store
│   │   ├── types/
│   │   ├── utils/                 # created when canvas needs its own utils
│   │   └── index.ts
│   │
│   ├── inspector/
│   │   ├── components/
│   │   ├── hooks/                 # created when inspector needs its own hooks
│   │   ├── types/
│   │   ├── schemas/                # created when the first Zod schema is needed
│   │   ├── utils/                  # created when inspector needs its own utils
│   │   └── index.ts
│   │
│   ├── components-library/
│   │   ├── components/
│   │   ├── definitions/             # created when element/template definitions exist
│   │   ├── types/
│   │   ├── schemas/                  # created when the first Zod schema is needed
│   │   └── index.ts
│   │
│   └── export/
│       ├── generators/                # created when HTML/CSS generation logic exists
│       ├── formatters/                 # created when output formatting logic exists
│       ├── types/
│       ├── schemas/                     # created when the first Zod schema is needed
│       ├── utils/
│       └── index.ts
│
├── lib/                      # framework-independent shared utilities/integrations
│   └── utils.ts               # cn() class-composition helper
│
└── styles/                     # global design tokens and shared styling infrastructure
    ├── tokens/                   # created when tokens are extracted from Tailwind config
    └── README.md
```

**Only what currently has content is created.** Subfolders and files marked
above as "created when…" do not exist yet and should not be scaffolded
ahead of need — see
[dependency-rules.md](./dependency-rules.md#do-not-pre-scaffold) and the
"File Placement Rules" in [CLAUDE.md](../../CLAUDE.md). The `.gitkeep`
placeholders currently present in empty feature folders (`components/ui`,
`styles`, and the empty subfolders under `features/*`) represent
already-approved near-term feature boundaries and may remain until real
files replace them.

Each feature's `index.ts` is a **public API boundary**, not an
export-everything barrel. It should only be created once the feature has
something stable worth exposing to the rest of the app, and it should only
re-export the specific symbols other code is meant to depend on — never
`export * from "./internal-file"`.

## Documentation structure (`docs/`)

```
docs/
├── architecture/       # how the code is organized and why (this directory)
├── decisions/          # Architecture Decision Records (ADRs)
├── roadmap/             # milestone sequencing
├── reports/              # point-in-time session/setup reports
├── archive/               # superseded docs, kept for history instead of deleted
├── prompts/                # successful Claude Code prompts, saved for reuse
├── ui/                       # design references for Layoutry's own application UI
├── project-idea.md            # original product concept
└── glossary.md                 # Layoutry-specific terminology
```

- `docs/archive/`, `docs/prompts/`, and `docs/ui/` are established
  conventions with a documented purpose (see each directory's `README.md`),
  even before they hold many files. This differs from `src/`, where empty
  folders are avoided — a documentation convention is useful the moment it
  is written down, whereas an empty source folder is not.
- Do not create additional top-level `docs/` folders without documenting
  their purpose the same way.

## Feature ownership

Detailed per-feature responsibilities (what each feature owns and must not
own) are documented in [CLAUDE.md's Architecture Rules](../../CLAUDE.md).
This file covers _where files go_; CLAUDE.md covers _who owns what_.
