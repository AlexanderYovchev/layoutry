# Frozen persistence fixtures (PROJECT-1.5)

Byte-exact data as earlier Layoutry checkpoints wrote it. Tests check
that every later build still opens it, without rewriting the file. Format
1, 2 and 3 files are migrated to the current format (4, revision 0) in
memory on open (BC-05.3, BC-09.2, BC-17.2); an older file re-saves to the
same bytes apart from its version metadata (`"formatVersion": 4,` plus
`"formatRevision": 0,`), and a format 4.0 file to the very same bytes.
Never regenerate or reformat these files: a change that breaks them is
a compatibility break. Add a new fixture instead. `.gitattributes` turns
off line-ending conversion here, because sizes and SHA-256 hashes are part
of the data.

| File | Written by | How |
| --- | --- | --- |
| `project-1.1-every-element.layoutry` | PROJECT-1.1 (`04ad3d8`) | `serializeProject` at that commit, run in a temporary worktree: every insertable element plus the kitchen-sink node |
| `native-site-original-1.3.layoutry` | PROJECT-1.3/1.4 serializer | the bytes a native Save writes (UTF-8 text, no wrapper) |
| `indexeddb-library-1.2.json` | PROJECT-1.2 repository (`0fcafaf`, unchanged since) | raw `summaries`/`documents` object stores of `layoutry-projects` v1, dumped after a real `repository.write` |
| `indexeddb-recovery-1.4.json` | PROJECT-1.4 browser recovery storage (`5489ae3`) | raw `summaries`/`texts` stores of `layoutry-recovery` v1, dumped after a real snapshot write |
| `22222222222222222222222222222222-4.layoutry-recovery` | PROJECT-1.4 desktop recovery store (`5489ae3`) | a real `createRecoveryStore().write` (header line + project text) |
| `project-2-spacing-zero.layoutry` | BC-05.3 (format 2) | `serializeProject` in a throwaway test: authored zero padding/margin, mixed sides, an unset button and an empty spacing record |
| `project-2-legacy-pagination.layoutry` | BC-08.5 code (`c6a0448`, format 2), frozen at the start of BC-09.2 | `serializeProject` in a throwaway test: Basic Navbar, Breadcrumbs, the pre-BC-09.2 Pagination preset (Previous/Next Buttons, no marker) with a click interaction on Next, and its target Paragraph |
| `project-2-legacy-pagination.export.index.html`, `.export.styles.css`, `.export.script.js` | same commit and run | `exportHtmlCss(document, { mode: "separate" })` of that file: what an old Pagination must still export byte for byte |
| `project-4.0-styling-foundation.layoutry` | BC-17.2 (format 4, revision 0) | `serializeProject` in a throwaway test: document counter, keyframes and project preset assets; style rules (hover, focus-visible, disabled, parent hover, ::before content with a counter, Progress parts); counter operations; outline; logical twins (padding, radius, inset, border, inline size); direction/writing mode; a custom Progress with segments and a formatted label. Every later revision step must keep opening it |
| `project-3-pagination.layoutry` | BC-09.2 (format 3) | `serializeProject` in a throwaway test: the new Pagination (marker, aria-label, aria-current, disabled Previous), a labelled header with a disabled button, and an aria-current="step" link |

Tests: `src/features/project/utils/legacyProjectFiles.test.ts`,
`src/features/project/commands/projectDesktopWorkflow.test.ts` (first-save
protection for format 1 and 2 originals), `test/fixtures/legacyPagination.ts`,
`src/features/project/storage/legacyStorageRecords.test.ts`,
`desktop/recovery/legacyRecoveryRecord.test.ts`.
