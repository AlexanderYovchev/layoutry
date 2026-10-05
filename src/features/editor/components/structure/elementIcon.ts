import {
  AppWindow,
  AudioLines,
  Box,
  ChevronDown,
  Circle,
  ClipboardList,
  Component,
  FileText,
  Frame,
  Image,
  Layout,
  LayoutPanelTop,
  Link,
  List,
  ListOrdered,
  Menu,
  Minus,
  MousePointerClick,
  Newspaper,
  PanelBottom,
  PanelRight,
  PanelTop,
  PictureInPicture2,
  Rows3,
  Spline,
  SquareDashed,
  Table,
  TableRowsSplit,
  Tag,
  TextCursorInput,
  TextQuote,
  Type,
  Video,
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
  select: ChevronDown,
  // Option (Checkpoint 1.13) reuses "li"'s exact icon — both are a
  // bullet-like leaf entry within one constrained parent; the Structure
  // row's own "Option — <text>" label (see elementDisplayName.ts)
  // already disambiguates individual Options from each other.
  option: Circle,
  // Table primitives (Checkpoint 1.14). Thead/Tfoot reuse Header/Footer's
  // own icons (PanelTop/PanelBottom) — same "top section"/"bottom
  // section" meaning, just inside a table instead of a page. Tbody
  // reuses "body"'s own Rows3 (a set of stacked rows, which is
  // literally what a tbody is). Th/Td share Type, the same "text-bearing
  // leaf" reasoning li/option's own shared Circle already established —
  // the Structure row's own "Header Cell"/"Data Cell" label (see
  // elementDisplayName.ts) already disambiguates the two from each
  // other.
  table: Table,
  thead: PanelTop,
  tbody: Rows3,
  tfoot: PanelBottom,
  tr: TableRowsSplit,
  th: Type,
  td: Type,
  video: Video,
  audio: AudioLines,
  iframe: AppWindow,
  svg: Spline,
  dialog: PictureInPicture2,
  // Divider/Fieldset/Legend (Checkpoint 1.15.6.12.1). Legend shares Type —
  // the same "text-bearing leaf with no distinct icon need" reasoning
  // th/td/li/option's own shared icons already establish above.
  hr: Minus,
  fieldset: SquareDashed,
  legend: Type,
  // Figure/Figcaption/Table Caption (Checkpoint 1.15.6.12.2). Figcaption
  // and Caption both share Type — the same convention as above.
  figure: Frame,
  figcaption: Type,
  caption: Type,
};
