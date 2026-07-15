export interface EditorElementNode {
  id: string;
  /** Lowercase HTML tag name, or a virtual pseudo-tag such as "page" for the document root. */
  tag: string;
  /** Overrides the tag-based friendly name (e.g. a component's assigned label like "Primary Button"). */
  displayName?: string;
  /** Literal text content for text-bearing leaf nodes (e.g. headings, paragraphs, buttons). Unset for structural nodes. */
  text?: string;
  children?: EditorElementNode[];
}
