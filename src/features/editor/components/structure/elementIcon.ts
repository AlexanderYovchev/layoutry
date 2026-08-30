import {
  Box,
  Circle,
  ClipboardList,
  Component,
  FileText,
  Image,
  Layout,
  LayoutPanelTop,
  Link,
  List,
  ListOrdered,
  Menu,
  MousePointerClick,
  Newspaper,
  PanelBottom,
  PanelRight,
  PanelTop,
  Rows3,
  Tag,
  TextCursorInput,
  TextQuote,
  Type,
  type LucideIcon,
} from "lucide-react";

export const FALLBACK_ELEMENT_ICON = Component;

/** Centralized tag-to-icon mapping for Structure tree rows. */
export const TAG_ICONS: Record<string, LucideIcon> = {
  page: FileText,
  body: Rows3,
  div: Box,
  section: Layout,
  h1: Type,
  h2: Type,
  h3: Type,
  h4: Type,
  h5: Type,
  h6: Type,
  p: Type,
  button: MousePointerClick,
  img: Image,
  a: Link,
  ul: List,
  ol: ListOrdered,
  li: Circle,
  nav: Menu,
  header: PanelTop,
  main: LayoutPanelTop,
  article: Newspaper,
  aside: PanelRight,
  footer: PanelBottom,
  form: ClipboardList,
  // Checkbox/Radio (Checkpoint 1.12) share this same "input" entry —
  // TAG_ICONS is a tag-only lookup, and distinguishing them would need
  // the same node-aware extension getElementDisplayName's own signature
  // already happened to allow for; out of this checkpoint's scope (see
  // its own report) since the Structure row's text label already
  // distinguishes "Checkbox"/"Radio" unambiguously.
  input: TextCursorInput,
  label: Tag,
  textarea: TextQuote,
};
