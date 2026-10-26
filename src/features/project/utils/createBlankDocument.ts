import type { EditorElementNode } from "@/features/editor/types/document";

/** The authored document of a brand-new project: an empty page. */
export function createBlankDocument(): EditorElementNode {
  return { id: "page-root", tag: "page", children: [] };
}
