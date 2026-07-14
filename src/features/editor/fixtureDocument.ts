import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Stand-in for a real, persisted document model (milestone M3 — see
 * docs/roadmap/milestones.md). Nothing in the Structure panel is aware
 * this is fixture data; once real document creation/loading exists, only
 * this file and the editor store's initial state need to change.
 */
export const fixtureDocument: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "section-1",
      tag: "section",
      children: [
        { id: "heading-1", tag: "h1" },
        { id: "paragraph-1", tag: "p" },
        { id: "button-1", tag: "button", displayName: "Primary Button" },
      ],
    },
    {
      id: "section-2",
      tag: "section",
      children: [{ id: "image-1", tag: "img" }],
    },
  ],
};
