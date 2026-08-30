import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { DEFAULT_LINK_HREF } from "@/features/editor/types/link";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ElementSpacing } from "@/features/editor/types/spacing";

/** Checkpoint 3.5's stated default for a newly created container: Block display, 16px padding on every side, zero margin. */
const DEFAULT_CONTAINER_SPACING: ElementSpacing = {
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  padding: { top: 16, right: 16, bottom: 16, left: 16 },
};

/**
 * Every element type this checkpoint's insertion system can create.
 * Deliberately a plain string union owned by the editor feature — the
 * Creation Toolbar (components/layout, which must not import features)
 * mirrors these exact string values locally rather than importing this
 * type; see creationToolbarCategories.ts.
 */
export type InsertableElementType =
  | "container"
  | "section"
  | "heading"
  | "paragraph"
  | "button"
  | "image"
  | "link"
  | "unorderedList"
  | "orderedList"
  | "listItem"
  | "header"
  | "nav"
  | "main"
  | "article"
  | "aside"
  | "footer"
  | "form"
  | "input"
  | "emailInput"
  | "passwordInput"
  | "numberInput"
  | "searchInput"
  | "urlInput"
  | "telInput"
  | "checkboxInput"
  | "radioInput"
  | "label"
  | "textarea"
  | "footerComposition";

export function createContainerNode(): EditorElementNode {
  return {
    id: generateNodeId("div"),
    tag: "div",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

/**
 * Section shares Container's exact structural defaults (Block display,
 * 16px padding, zero margin) — same editor-usability philosophy, only the
 * semantic tag differs. See ContainerElement, which both tags render
 * through.
 */
export function createSectionNode(): EditorElementNode {
  return {
    id: generateNodeId("section"),
    tag: "section",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

export function createHeadingNode(): EditorElementNode {
  return { id: generateNodeId("h1"), tag: "h1", text: "New Heading" };
}

export function createParagraphNode(): EditorElementNode {
  return { id: generateNodeId("p"), tag: "p", text: "New paragraph text." };
}

export function createButtonNode(): EditorElementNode {
  return { id: generateNodeId("button"), tag: "button", text: "Button" };
}

/**
 * Stamps a real, concrete href immediately (mirroring createImageNode's
 * own concrete placeholder src, not left unset for a resolver to fill
 * in) — a Link is only genuinely a link, semantically and for keyboard
 * focus, once it has a real destination; see types/link.ts's own doc
 * comment for why DEFAULT_LINK_HREF ("#") is a safe, inert choice.
 */
export function createLinkNode(): EditorElementNode {
  return { id: generateNodeId("a"), tag: "a", text: "Link text", href: DEFAULT_LINK_HREF };
}

/** A single, freshly-created list item — used both standalone (the "List Item" catalog entry) and as list-starter content below. */
export function createListItemNode(): EditorElementNode {
  return { id: generateNodeId("li"), tag: "li", text: "List item" };
}

/**
 * A newly inserted list ships with three starter items so it's
 * immediately understandable and usable (Checkpoint 1.6) rather than an
 * empty <ul>/<ol> the user must first learn how to populate. The starter
 * items are ordinary children created inline on the returned node, not a
 * separate insertion step — one insertElement call (one history entry)
 * is all that's needed, since insertNode already inserts a node's full
 * subtree in one immutable write. Shares Container/Section's exact
 * structural defaults (Block display, 16px padding, zero margin) for the
 * same editor-usability reasons — see DEFAULT_CONTAINER_SPACING above.
 */
function createStarterListItems(): EditorElementNode[] {
  return [createListItemNode(), createListItemNode(), createListItemNode()];
}

export function createUnorderedListNode(): EditorElementNode {
  return {
    id: generateNodeId("ul"),
    tag: "ul",
    children: createStarterListItems(),
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

export function createOrderedListNode(): EditorElementNode {
  return {
    id: generateNodeId("ol"),
    tag: "ol",
    children: createStarterListItems(),
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

/**
 * The semantic sectioning family (Checkpoint 1.8) — Header/Nav/Main/
 * Article/Aside/Footer. Each is a primitive semantic HTML container, not
 * a designed composition (no logo/menu/copyright/newsletter content is
 * stamped in) — see this checkpoint's report for why. All six share
 * Container/Section's exact structural defaults (Block display, 16px
 * padding, zero margin) for the same editor-usability reasons; only the
 * semantic tag differs, matching Section's own precedent.
 */
export function createHeaderNode(): EditorElementNode {
  return {
    id: generateNodeId("header"),
    tag: "header",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

export function createNavNode(): EditorElementNode {
  return {
    id: generateNodeId("nav"),
    tag: "nav",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

export function createMainNode(): EditorElementNode {
  return {
    id: generateNodeId("main"),
    tag: "main",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

export function createArticleNode(): EditorElementNode {
  return {
    id: generateNodeId("article"),
    tag: "article",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

export function createAsideNode(): EditorElementNode {
  return {
    id: generateNodeId("aside"),
    tag: "aside",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

export function createFooterNode(): EditorElementNode {
  return {
    id: generateNodeId("footer"),
    tag: "footer",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

/**
 * "Simple Footer" starter composition (Checkpoint 1.12.1) — the primitive
 * `footer` tag above stays a neutral, empty structural element on
 * purpose (see its own doc comment); this is a SEPARATE catalog entry
 * that ships pre-populated with ordinary primitives, for users who want a
 * usable starting point rather than an empty shell. Every node here is a
 * genuine, independently-editable primitive (div/p/nav/a) built from the
 * exact same fields their own standalone factories use — no proprietary
 * "FooterComponentNode", no opaque/locked subtree. Built inline on one
 * returned node, the same way the List factories already ship 3 starter
 * `<li>` items: insertNode inserts a whole subtree in one immutable
 * write, so one insertElement call is still exactly one history entry.
 */
export function createFooterCompositionNode(): EditorElementNode {
  return {
    id: generateNodeId("footer"),
    tag: "footer",
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
    children: [
      {
        id: generateNodeId("div"),
        tag: "div",
        flowLayout: { display: "block" },
        spacing: DEFAULT_CONTAINER_SPACING,
        children: [
          {
            id: generateNodeId("p"),
            tag: "p",
            text: "© 2026 Your Company. All rights reserved.",
          },
          {
            id: generateNodeId("nav"),
            tag: "nav",
            flowLayout: { display: "block" },
            children: [
              { id: generateNodeId("a"), tag: "a", text: "Privacy", href: DEFAULT_LINK_HREF },
              { id: generateNodeId("a"), tag: "a", text: "Terms", href: DEFAULT_LINK_HREF },
              { id: generateNodeId("a"), tag: "a", text: "Contact", href: DEFAULT_LINK_HREF },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Form (Checkpoint 1.10) shares Container/Section/the semantic sectioning
 * family's exact structural defaults — same editor-usability philosophy,
 * only the semantic tag differs (see ContainerElement, which all of them
 * render through). A newly inserted Form is an empty structural
 * primitive; it never auto-creates an Input child.
 */
export function createFormNode(): EditorElementNode {
  return {
    id: generateNodeId("form"),
    tag: "form",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

/**
 * Every text-like Input variant (Checkpoint 1.10's Text, widened to the
 * full text-like family in Checkpoint 1.11: Email/Password/Number/
 * Search/URL/Tel) is the exact same `tag: "input"` leaf, differing only
 * in `inputType` and its own sensible starter placeholder — never a
 * second tag or a dedicated node concept per variant (see
 * types/input.ts's own top comment). `value` is deliberately left unset
 * rather than pre-populated: it represents an authored default a real
 * form would submit, and a freshly inserted control has no meaningful
 * default yet — `placeholder` alone (inert, native, immediately visible
 * on the Canvas) is what makes an empty Input legible without inventing
 * fake authored data. No opinionated visual styling, matching every
 * other primitive factory in this file.
 */
function createInputNodeWithType(inputType: EditorElementNode["inputType"], placeholder: string): EditorElementNode {
  return {
    id: generateNodeId("input"),
    tag: "input",
    inputType,
    placeholder,
  };
}

export function createInputNode(): EditorElementNode {
  return createInputNodeWithType("text", "Enter text");
}

export function createEmailInputNode(): EditorElementNode {
  return createInputNodeWithType("email", "Enter email");
}

export function createPasswordInputNode(): EditorElementNode {
  return createInputNodeWithType("password", "Enter password");
}

export function createNumberInputNode(): EditorElementNode {
  return createInputNodeWithType("number", "Enter number");
}

export function createSearchInputNode(): EditorElementNode {
  return createInputNodeWithType("search", "Search…");
}

export function createUrlInputNode(): EditorElementNode {
  return createInputNodeWithType("url", "https://example.com");
}

export function createTelInputNode(): EditorElementNode {
  return createInputNodeWithType("tel", "Enter phone number");
}

/**
 * Checkbox/Radio (Checkpoint 1.12) — the exact same `tag: "input"` leaf
 * as every text-like variant, differing only in `inputType`; see
 * types/input.ts's own top comment for why this stays one document
 * concept rather than a separate node type. Deliberately no placeholder
 * (native checkbox/radio ignore it entirely — inventing one would be
 * fake authored data with no meaning) and no starter `name`/`value`/
 * `checked` — the same "empty until the user sets something real"
 * philosophy createInputNode already follows.
 */
export function createCheckboxNode(): EditorElementNode {
  return { id: generateNodeId("input"), tag: "input", inputType: "checkbox" };
}

export function createRadioNode(): EditorElementNode {
  return { id: generateNodeId("input"), tag: "input", inputType: "radio" };
}

/**
 * Label (Checkpoint 1.11) — a childable semantic container sharing
 * Container/Section/Form's exact structural defaults, exactly like the
 * Checkpoint 1.8 semantic sectioning family. Phase one is deliberately
 * childable-only, never text-editable (see types/document.ts's own
 * label-related doc comments and this checkpoint's report): wrapping an
 * Input is the only supported association model for now — no `for`/`id`
 * yet. A newly inserted Label is empty; it never auto-creates an Input
 * child, matching Form's own "empty structural primitive" precedent.
 */
export function createLabelNode(): EditorElementNode {
  return {
    id: generateNodeId("label"),
    tag: "label",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

/**
 * Textarea (Checkpoint 1.12) — a genuine `tag: "textarea"` leaf, not
 * Input with a variant: multiline text is a real, distinct native
 * element, not another `inputType`. Reuses Input's own `name`/
 * `placeholder`/`value` fields unchanged (the same semantic concern —
 * an authored default a real form control carries — deserves the same
 * document field across compatible controls; see this checkpoint's own
 * report for why no textareaValue/etc. duplicate was created). `value`
 * is left unset for the same "no fake authored data" reason
 * createInputNode already follows.
 */
export function createTextareaNode(): EditorElementNode {
  return {
    id: generateNodeId("textarea"),
    tag: "textarea",
    placeholder: "Enter text",
  };
}

/**
 * A generic placeholder photo, not a real asset — this app has no image
 * upload/picker yet (out of scope for Checkpoint 3.5.1). An inline SVG
 * with explicit width/height gives the <img> a real, non-square intrinsic
 * aspect ratio (4:3), which is what actually makes object-fit meaningful:
 * a plain colored box has no "natural size" for object-fit to preserve.
 */
const DEFAULT_IMAGE_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
      '<rect width="400" height="300" fill="#e4e4e7"/>' +
      '<path d="M0 230 L110 130 L190 190 L270 100 L400 230 V300 H0 Z" fill="#a1a1aa"/>' +
      '<circle cx="320" cy="70" r="28" fill="#a1a1aa"/>' +
      "</svg>",
  );

export function createImageNode(): EditorElementNode {
  return { id: generateNodeId("img"), tag: "img", src: DEFAULT_IMAGE_SRC };
}

const FACTORIES_BY_TYPE: Record<InsertableElementType, () => EditorElementNode> = {
  container: createContainerNode,
  section: createSectionNode,
  heading: createHeadingNode,
  paragraph: createParagraphNode,
  button: createButtonNode,
  image: createImageNode,
  link: createLinkNode,
  unorderedList: createUnorderedListNode,
  orderedList: createOrderedListNode,
  listItem: createListItemNode,
  header: createHeaderNode,
  nav: createNavNode,
  main: createMainNode,
  article: createArticleNode,
  aside: createAsideNode,
  footer: createFooterNode,
  form: createFormNode,
  input: createInputNode,
  emailInput: createEmailInputNode,
  passwordInput: createPasswordInputNode,
  numberInput: createNumberInputNode,
  searchInput: createSearchInputNode,
  urlInput: createUrlInputNode,
  telInput: createTelInputNode,
  checkboxInput: createCheckboxNode,
  radioInput: createRadioNode,
  label: createLabelNode,
  textarea: createTextareaNode,
  footerComposition: createFooterCompositionNode,
};

/** Every element factory dispatches through here — the one place new insertable types get registered. */
export function createElementNode(type: InsertableElementType): EditorElementNode {
  return FACTORIES_BY_TYPE[type]();
}

export function isInsertableElementType(value: string): value is InsertableElementType {
  return value in FACTORIES_BY_TYPE;
}

/**
 * A freshly created node has no dimensions at all — it sizes itself
 * naturally in Flow. A Free container has no such thing as "size itself
 * naturally" (every direct child needs an explicit width/height), so
 * insertion into a Free parent (see useInsertElement) and clipboard
 * placement into a Free parent (see resolveClonePlacementForFreeParent in
 * useEditorStore) both need a reasonable starting size per element type.
 */
const DEFAULT_FREE_ELEMENT_SIZE: Record<InsertableElementType, { width: number; height: number }> = {
  container: { width: 200, height: 150 },
  section: { width: 200, height: 150 },
  heading: { width: 240, height: 48 },
  paragraph: { width: 240, height: 80 },
  button: { width: 120, height: 40 },
  image: { width: 200, height: 150 },
  link: { width: 120, height: 32 },
  unorderedList: { width: 220, height: 150 },
  orderedList: { width: 220, height: 150 },
  listItem: { width: 160, height: 32 },
  header: { width: 200, height: 150 },
  nav: { width: 200, height: 150 },
  main: { width: 200, height: 150 },
  article: { width: 200, height: 150 },
  aside: { width: 200, height: 150 },
  footer: { width: 200, height: 150 },
  form: { width: 200, height: 150 },
  input: { width: 200, height: 40 },
  emailInput: { width: 200, height: 40 },
  passwordInput: { width: 200, height: 40 },
  numberInput: { width: 200, height: 40 },
  searchInput: { width: 200, height: 40 },
  urlInput: { width: 200, height: 40 },
  telInput: { width: 200, height: 40 },
  checkboxInput: { width: 20, height: 20 },
  radioInput: { width: 20, height: 20 },
  label: { width: 220, height: 60 },
  textarea: { width: 240, height: 100 },
  footerComposition: { width: 320, height: 160 },
};

const DEFAULT_FREE_SIZE_FALLBACK = { width: 160, height: 120 };

/** Reverse of FACTORIES_BY_TYPE's tag choice, for resolving a default size from a tag alone (see getDefaultFreeElementSize). */
const INSERTABLE_TYPE_BY_TAG: Record<string, InsertableElementType> = {
  div: "container",
  section: "section",
  h1: "heading",
  p: "paragraph",
  button: "button",
  img: "image",
  a: "link",
  ul: "unorderedList",
  ol: "orderedList",
  li: "listItem",
  header: "header",
  nav: "nav",
  main: "main",
  article: "article",
  aside: "aside",
  footer: "footer",
  form: "form",
  input: "input",
  label: "label",
  textarea: "textarea",
};

/** Falls back to a generic size for a tag with no InsertableElementType entry (e.g. a pasted/duplicated node whose tag isn't one of the five catalog types). */
export function getDefaultFreeElementSize(tag: string): { width: number; height: number } {
  const type = INSERTABLE_TYPE_BY_TAG[tag];
  return type ? DEFAULT_FREE_ELEMENT_SIZE[type] : DEFAULT_FREE_SIZE_FALLBACK;
}
