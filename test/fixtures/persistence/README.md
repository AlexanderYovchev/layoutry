# Frozen persistence fixtures (PROJECT-1.5)

Byte-exact data as earlier Layoutry checkpoints wrote it. Tests check
that every later build still opens it, without migrating or rewriting it.
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

Tests: `src/features/project/utils/legacyProjectFiles.test.ts`,
`src/features/project/storage/legacyStorageRecords.test.ts`,
`desktop/recovery/legacyRecoveryRecord.test.ts`.
