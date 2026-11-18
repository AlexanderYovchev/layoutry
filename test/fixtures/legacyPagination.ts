import { readFileSync } from "node:fs";
import path from "node:path";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * The Pagination preset as Layoutry made it before BC-09.2 (Previous/Next
 * Buttons, no marker, no accessibility fields), read from the frozen format
 * 2 fixture `persistence/project-2-legacy-pagination.layoutry` (written by
 * the BC-08.5 code, c6a0448). Each call returns a fresh copy.
 *
 * Its Next button has a click interaction targeting `legacy-panel`, a
 * Paragraph outside the nav. A document that is saved must contain that
 * target (or drop the interaction), or serializing it fails.
 */
export function legacyPaginationNode(): EditorElementNode {
  const text = readFileSync(
    path.join(process.cwd(), "test", "fixtures", "persistence", "project-2-legacy-pagination.layoutry"),
    "utf8",
  );
  const result = parseProjectFile(text);
  if (!result.ok) throw new Error(result.error.message);
  const pagination = result.project.document.children?.[2];
  if (pagination?.tag !== "nav") throw new Error("the fixture's third element is not the Pagination nav");
  return pagination;
}
