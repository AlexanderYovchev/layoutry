import { getInputType, type InputType } from "@/features/editor/types/input";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Subtype-aware Structure names for Input (Checkpoint 1.11) — now that
 * `inputType` actually varies, a bare tag-only lookup ("Input" for
 * every variant) stopped being the most useful label the Structure
 * panel could show. Kept separate from TAG_DISPLAY_NAMES rather than
 * folded into it: this one needs the whole node (to read inputType),
 * not just the tag, the same "node, not tag, if it's cheap" reasoning
 * getElementDisplayName's own signature already allowed for.
 */
const INPUT_TYPE_DISPLAY_NAMES: Record<InputType, string> = {
  text: "Text Input",
  email: "Email Input",
  password: "Password Input",
  number: "Number Input",
  search: "Search Input",
  url: "URL Input",
  tel: "Tel Input",
  // Checkbox/Radio (Checkpoint 1.12) deliberately read as "Checkbox"/
  // "Radio" rather than "Checkbox Input"/"Radio Input" — clearer to
  // users, and consistent with how every other Structure label already
  // favors the shortest name that's still unambiguous (e.g. "Link", not
  // "Link Anchor").
  checkbox: "Checkbox",
  radio: "Radio",
};

const TAG_DISPLAY_NAMES: Record<string, string> = {
  page: "Page",
  body: "Body",
  div: "Container",
  section: "Section",
  h1: "Heading",
  h2: "Heading",
  h3: "Heading",
  h4: "Heading",
  h5: "Heading",
  h6: "Heading",
  p: "Paragraph",
  button: "Button",
  img: "Image",
  a: "Link",
  ul: "Unordered List",
  ol: "Ordered List",
  li: "List Item",
  nav: "Navigation",
  header: "Header",
  main: "Main",
  article: "Article",
  aside: "Aside",
  footer: "Footer",
  form: "Form",
  input: "Input",
  label: "Label",
  textarea: "Textarea",
  select: "Select",
  option: "Option",
  table: "Table",
  thead: "Table Head",
  tbody: "Table Body",
  tfoot: "Table Foot",
  tr: "Table Row",
  th: "Header Cell",
  td: "Data Cell",
  video: "Video",
  // "Embed" (Checkpoint 1.15), not "Iframe" — the same beginner-friendly,
  // purpose-named-over-raw-tag-name convention this table already uses
  // throughout (div -> "Container", li -> "List Item", table's own
  // sub-primitives -> "Table Head"/"Header Cell"/etc.), rather than
  // switching to raw-HTML-tag naming just for this one entry. The real
  // tag stays "iframe" underneath (see createIframeNode) — see this
  // checkpoint's report, section M, for the full reasoning.
  iframe: "Embed",
};

/**
 * The single friendly-name source for the document tree. A node's own
 * displayName (e.g. a component's assigned label) always wins; Input is
 * resolved through its own inputType-aware table (see
 * INPUT_TYPE_DISPLAY_NAMES above — "Email Input"/"Password Input"/etc.,
 * not a single generic "Input" regardless of variant); everything else
 * falls back to the plain tag mapping, then the raw tag itself for
 * anything unrecognized.
 */
/** Option (Checkpoint 1.13) — appends its own authored text so siblings read as e.g. "Option — Bulgaria" in the Structure panel, the one place Canvas-unreliable Option selection needs to be easy to tell apart (brief's own example). Skipped when the text is empty or still exactly the bare "Option" default, so a freshly-created Option never reads as the redundant "Option — Option". */
function optionDisplayName(node: EditorElementNode): string {
  const base = TAG_DISPLAY_NAMES.option;
  return node.text && node.text !== base ? `${base} — ${node.text}` : base;
}

/** Header/Data Cell (Checkpoint 1.14) — the same "append the node's own text" treatment optionDisplayName above already established, so a cell reads as e.g. "Header Cell — Name"/"Data Cell — Bulgaria" in Structure (brief's own example) rather than a sea of indistinguishable "Header Cell"/"Data Cell" rows. Skipped when the text is empty or still exactly the bare default ("Heading"/"Cell" — see createTableHeaderCellNode/createTableDataCellNode), so a freshly-created cell never reads as the redundant "Header Cell — Heading". */
function tableCellDisplayName(node: EditorElementNode): string {
  const base = TAG_DISPLAY_NAMES[node.tag];
  return node.text && node.text !== "Heading" && node.text !== "Cell" ? `${base} — ${node.text}` : base;
}

export function getElementDisplayName(node: EditorElementNode): string {
  if (node.displayName) return node.displayName;
  if (node.tag === "input") return INPUT_TYPE_DISPLAY_NAMES[getInputType(node)];
  if (node.tag === "option") return optionDisplayName(node);
  if (node.tag === "th" || node.tag === "td") return tableCellDisplayName(node);
  return TAG_DISPLAY_NAMES[node.tag] ?? node.tag;
}

/**
 * The tag badge is only useful when it tells the user something the
 * display name doesn't already say — e.g. "Heading" next to "h1", or a
 * custom component label like "Primary Button" next to "button". When
 * the display name is just the tag itself (Section/section,
 * Header/header, Page/page), showing the tag again would be redundant.
 */
export function shouldShowTagBadge(node: EditorElementNode): boolean {
  return getElementDisplayName(node).toLowerCase() !== node.tag.toLowerCase();
}
