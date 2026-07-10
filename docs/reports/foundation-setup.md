# Foundation Setup Report

**Date:** 2026-07-10
**Status at time of writing:** Not committed — working tree changes were staged for review only.

## 1. What this was

Scaffolded the initial Next.js (App Router + TypeScript strict + Tailwind
CSS) technical foundation for Layoutry, a browser-based visual HTML/CSS
editor SaaS. Only a minimal application shell was built — the actual
editor, canvas, inspector, and export logic are **not** implemented. No
auth, database, payments, AI, or other later-milestone dependencies were
installed.

## 2. Pre-existing state (before this setup)

- `README.md`, `.gitignore`, `docs/project-idea.md`, and a raw notes `.txt`
  file only.
- No `package.json`, no source code, no `LICENSE` file.
- Git: clean working tree, branch `main`, origin →
  `github.com/AlexanderYovchev/layoutry.git`.
- Node v24.14.0, npm 11.9.0.

## 3. Scaffolding method

`create-next-app`'s non-empty-directory allowlist does not cover this
repo's `.claude/` directory or the loose notes `.txt` file, so scaffolding
directly into the repo was not safe. Instead:

1. Ran `npx create-next-app@latest` in a temporary directory outside the
   repo with flags: `--typescript --tailwind --eslint --app --src-dir
--import-alias "@/*" --use-npm --turbopack`.
2. Inspected the generated output.
3. Copied only the necessary base files into the repo root (`package.json`,
   `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`,
   `eslint.config.mjs`, `next-env.d.ts`, `src/app/globals.css`) and
   rewrote `src/app/layout.tsx` and `src/app/page.tsx` from scratch for
   Layoutry's actual shell.
4. Deleted the temporary directory.
5. Merged new ignore rules into the **existing** `.gitignore` rather than
   overwriting it.

The repo root remains the application root — no nested app directory.

## 4. Dependencies installed and why

**Runtime:**

| Package                      | Purpose                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `next@16.2.10`               | App Router framework (current stable)                                                           |
| `react` / `react-dom@19.2.4` | UI library (version resolved by create-next-app's own compatibility contract with Next 16.2.10) |
| `zustand@^5.0.14`            | Future editor state management                                                                  |
| `@dnd-kit/core@^6.3.1`       | Future drag/drop primitives                                                                     |
| `@dnd-kit/sortable@^10.0.0`  | Future element reordering                                                                       |
| `@dnd-kit/utilities@^3.2.2`  | Future drag/drop utilities                                                                      |
| `zod@^4.4.3`                 | Future runtime validation of project/editor data                                                |
| `lucide-react@^1.24.0`       | Interface icons                                                                                 |
| `clsx@^2.1.1`                | Conditional className composition                                                               |
| `tailwind-merge@^3.6.0`      | Safe Tailwind class merging                                                                     |

**Dev/Test:**

| Package                                                  | Purpose                              |
| -------------------------------------------------------- | ------------------------------------ |
| `typescript@^5` (resolved 5.9.3)                         | Strict-mode TypeScript               |
| `tailwindcss@^4` / `@tailwindcss/postcss@^4`             | Styling                              |
| `eslint@^9` / `eslint-config-next@16.2.10`               | Next.js's own recommended lint setup |
| `prettier@^3.9.5` / `prettier-plugin-tailwindcss@^0.8.0` | Formatting                           |
| `vitest@^4.1.10` / `jsdom@^29.1.1`                       | Unit/component test runner           |
| `@testing-library/react`, `jest-dom`, `user-event`       | Component testing                    |
| `@vitejs/plugin-react@^6.0.3`                            | Required by Vitest+React config      |
| `@playwright/test@^1.61.1`                               | End-to-end testing                   |

**Not installed** (explicitly out of scope per the setup instructions):
auth, database/ORM, Stripe, AI SDKs, cloud storage, analytics, React Flow,
Fabric.js, Konva, Moveable, interact.js, UI kits (MUI/Chakra/AntD),
shadcn/ui, Storybook, persistence libraries, form libraries, animation
libraries.

**Note — TypeScript version:** npm's "latest" tag for `typescript` is
7.0.2, but Next.js 16.2.10's own official template pins `"typescript":
"^5"`. Deferred to Next.js's own verified compatibility range (resolved
5.9.3) rather than force an unvalidated major-version jump to the
still-very-new TS7 native compiler port.

## 5. Source structure created

```
src/
  app/                 layout.tsx, page.tsx, globals.css
  components/
    ui/                empty (.gitkeep) — no shared primitives justified yet
    layout/            AppHeader.tsx + AppHeader.test.tsx
  features/
    editor/components/                       EditorPlaceholder.tsx
    editor/{hooks,stores,types,utils}/        empty (.gitkeep)
    canvas/{components,hooks,types}/          empty (.gitkeep)
    inspector/components/                     InspectorPlaceholder.tsx
    inspector/types/                          empty (.gitkeep)
    components-library/{components,types}/    empty (.gitkeep)
    export/{types,utils}/                     empty (.gitkeep)
  lib/
    utils.ts             cn() helper (clsx + tailwind-merge)
  styles/                empty (.gitkeep) — reserved for future design tokens
test/
  setup.ts               Vitest + jest-dom setup
e2e/
  smoke.spec.ts           Playwright smoke test
```

No canvas engine, DOM-mutation system, iframe, or `contentEditable` region
was implemented. The structure is organized so a typed, serializable
document model can be introduced later as the canvas's source of truth —
see [docs/architecture/editor-domain-model.md](../architecture/editor-domain-model.md).

## 6. Application shell

- `AppHeader`: shows "Layoutry" + tagline "Build layouts visually. Own the
  code."
- `EditorPlaceholder`: labeled placeholder region ("Editor canvas — coming
  soon").
- `InspectorPlaceholder`: labeled placeholder region ("Style inspector —
  coming soon").
- Home page: composes the above + "Development foundation operational."
  line.
- No `"use client"` anywhere — nothing is interactive yet, so everything is
  a server component by default.
- Dropped the default Geist Google Font dependency (network fetch at build
  time) in favor of the system font stack, to keep the build fully
  offline-safe.
- Skipped create-next-app's default placeholder `public/` SVGs and
  favicon — no branding assets exist yet, so none were fabricated.

## 7. Environment validation

Skipped intentionally. No environment variables are genuinely required yet
(no auth/DB/external services in this milestone), so no `.env.example` or
env validation module was created, per the "only if genuinely required"
condition of the original setup task.

## 8. Package scripts added

`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`,
`test:e2e`, `format`, `format:check`.

## 9. Files created

`.prettierignore`, `.prettierrc.json`, `e2e/smoke.spec.ts`,
`eslint.config.mjs`, `next-env.d.ts` (gitignored, auto-generated),
`next.config.ts`, `package.json`, `package-lock.json`,
`playwright.config.ts`, `postcss.config.mjs`, `src/app/globals.css`,
`src/app/layout.tsx`, `src/app/page.tsx`,
`src/components/layout/AppHeader.tsx`,
`src/components/layout/AppHeader.test.tsx`,
`src/features/editor/components/EditorPlaceholder.tsx`,
`src/features/inspector/components/InspectorPlaceholder.tsx`,
`src/lib/utils.ts`, `test/setup.ts`, `tsconfig.json`, `vitest.config.ts`,
plus 12 `.gitkeep` files in architectural placeholder directories, and the
original `SETUP-SUMMARY.txt` (superseded by this report).

## 10. Files modified

- `.gitignore` — added `*.pem`, `next-env.d.ts`, `.vercel`, and Playwright
  output ignores (`test-results/`, `playwright-report/`, `blob-report/`,
  `playwright/.cache/`), on top of the existing rules (not replaced).
- `README.md` — added Status update, Technology Stack, Prerequisites,
  Installation, Development, Testing, Other Commands, and Initial
  Architecture sections. Existing Vision/Product Principles/License
  sections preserved as-is.

## 11. Commands executed

```
npx create-next-app@latest ...   (in temp dir)
npm install zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities zod lucide-react clsx tailwind-merge
npm install -D prettier prettier-plugin-tailwindcss vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitejs/plugin-react @playwright/test
npm install                      (after adding "overrides" for postcss)
npm run lint
npm run typecheck
npm run test
npm run build
npm run format / format:check
npx playwright install chromium
npm run test:e2e
```

## 12. Verification results

| Check               | Result                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`       | PASS                                                                                                                                |
| `npm run lint`      | PASS (0 errors)                                                                                                                     |
| `npm run typecheck` | PASS (0 errors)                                                                                                                     |
| `npm run test`      | PASS (1/1 test — AppHeader renders "Layoutry" + tagline)                                                                            |
| `npm run build`     | PASS (Next.js 16.2.10, Turbopack, static prerender of `/` and `/_not-found`)                                                        |
| `npm run test:e2e`  | PASS (1/1 Playwright smoke test — home page shows product name, tagline, foundation-operational line, and both placeholder regions) |
| `npm audit`         | 0 vulnerabilities (see section 13)                                                                                                  |

## 13. Security / dependency notes

`npm install` initially reported 2 moderate vulnerabilities: a transitive
postcss XSS advisory (GHSA-qx2v-qp2m-jg93), reachable only through Next.js's
own internal, exact-pinned `postcss@8.4.31` (not something app code invokes
directly — the project's own Tailwind/Vite pipeline already resolved to the
safe 8.5.16). `npm audit fix --force` was **not** run — its suggested fix
would have downgraded Next.js to 9.3.3, a five-year-old breaking version.
Instead, added a safe `"overrides": { "postcss": "^8.5.10" }` entry to
`package.json`, which deduplicates all postcss usage (Next.js, Tailwind,
Vite) onto 8.5.16. Re-ran `npm audit`: 0 vulnerabilities.

## 14. Unresolved warnings / risks (at time of writing)

- The local project folder was still named "Visual CSS Playground Project"
  on disk (a prior rename to "Layoutry" was blocked by a Windows file-lock
  caused by the session holding the folder open as its working directory).
  Not addressed in the original setup task; unrelated to the Next.js setup
  itself.
- No favicon/app icon exists yet — browsers will silently 404 on
  `/favicon.ico`. Harmless, but worth adding real branding assets later.
- TypeScript resolved to 5.9.3, not the npm "latest" 7.0.2 tag —
  intentional, see section 4.
- This was a first-run scaffold; no CI pipeline was configured (out of
  scope for that task).

## 15. Git state at time of writing (not committed)

```
git status: modified — .gitignore, README.md
            untracked — .prettierignore, .prettierrc.json, e2e/,
            eslint.config.mjs, next.config.ts, package.json,
            package-lock.json, playwright.config.ts, postcss.config.mjs,
            src/, test/, tsconfig.json, vitest.config.ts

git diff --stat (tracked files only):
 .gitignore | 11 +++++++++
 README.md  | 77 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++-
 2 files changed, 87 insertions(+), 1 deletion(-)
```

No commit was created. No push was made. No GitHub repository settings were
touched. No Git history was modified.

> This report is a point-in-time snapshot from the foundation-setup
> session. For current repository state, use `git status` and `git log`
> rather than this document.
