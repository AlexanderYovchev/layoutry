export interface EditorElementNode {
  id: string;
  /** Lowercase HTML tag name, or a virtual pseudo-tag such as "page" for the document root. */
  tag: string;
  /** Overrides the tag-based friendly name (e.g. a component's assigned label like "Primary Button"). */
  displayName?: string;
  children?: EditorElementNode[];
}
