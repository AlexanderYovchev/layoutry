import {
  createButtonGroupNode,
  createDropdownButtonNode,
  createGhostButtonNode,
  createOutlineButtonNode,
  createPrimaryButtonNode,
  createSecondaryButtonNode,
} from "@/features/editor/factories/buttonCompositions";
import {
  createBasicNavbarNode,
  createBreadcrumbsNode,
  createCenteredNavbarNode,
  createNavbarWithCtaNode,
  createPaginationNode,
  createSidebarNavigationNode,
} from "@/features/editor/factories/navigationCompositions";
import {
  createBasicCardNode,
  createFeatureCardNode,
  createHorizontalCardNode,
  createImageCardNode,
  createPricingCardNode,
  createProfileCardNode,
} from "@/features/editor/factories/cardCompositions";
import {
  createContactFormNode,
  createLabeledSelectFieldNode,
  createLabeledTextFieldNode,
  createLoginFormNode,
  createNewsletterSignupNode,
  createSearchBarNode,
} from "@/features/editor/factories/formCompositions";
import {
  createAvatarNode,
  createAvatarWithTextNode,
  createBadgeNode,
  createMetadataRowNode,
  createStatCardNode,
} from "@/features/editor/factories/dataDisplayCompositions";
import { createCollapsibleNode, createModalNode } from "@/features/editor/factories/interactionCompositions";
import {
  createDismissibleAlertNode,
  createErrorAlertNode,
  createInfoAlertNode,
  createManualToastNode,
  createSuccessAlertNode,
  createWarningAlertNode,
} from "@/features/editor/factories/feedbackCompositions";
import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { DEFAULT_SVG_FILL } from "@/features/editor/types/svg";
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
  | "footerComposition"
  | "select"
  | "table"
  | "video"
  | "iframe"
  | "svg"
  | "dialog"
  | "primaryButton"
  | "secondaryButton"
  | "outlineButton"
  | "ghostButton"
  | "buttonGroup"
  | "dropdownButton"
  | "basicNavbar"
  | "navbarWithCta"
  | "centeredNavbar"
  | "breadcrumbs"
  | "pagination"
  | "sidebarNavigation"
  | "basicCard"
  | "imageCard"
  | "horizontalCard"
  | "profileCard"
  | "featureCard"
  | "pricingCard"
  | "labeledTextField"
  | "searchBar"
  | "newsletterSignup"
  | "contactForm"
  | "loginForm"
  | "labeledSelectField"
  | "badge"
  | "avatar"
  | "avatarWithText"
  | "statCard"
  | "metadataRow"
  | "collapsible"
  | "modal"
  | "infoAlert"
  | "successAlert"
  | "warningAlert"
  | "errorAlert"
  | "dismissibleAlert"
  | "manualToast";

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
 *
 * `typography.textDecorationLine: "underline"` (Checkpoint 1.15.6.10.3)
 * is the same move for Link's own starter underline: previously an
 * unconditional, un-overridable LinkElement className, now real authored
 * document CSS — visible as "Set" in the Typography Inspector, changeable,
 * resettable, exportable. LinkElement's own renderer still carries a
 * legacy underline fallback (active only while `textDecorationLine` is
 * unset) so the many OTHER call sites that construct a raw `tag: "a"`
 * node directly (Simple Footer, Dropdown Button's menu items, Navbar/Card
 * compositions with their own stamped typography) keep looking exactly as
 * they always have without each needing this same field individually —
 * see LinkElement's own doc comment for the full reasoning.
 */
export function createLinkNode(): EditorElementNode {
  return {
    id: generateNodeId("a"),
    tag: "a",
    text: "Link text",
    href: DEFAULT_LINK_HREF,
    typography: { textDecorationLine: "underline" },
  };
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
 * A single, freshly-created Option (Checkpoint 1.13) — used both as the
 * "Options: N" count control's growth entry and, composed with distinct
 * text/value below, as Select's own starter set. A genuine leaf (see
 * OptionElement/insertionRules.ts's own doc comments) — no children, no
 * flowLayout/spacing, matching List Item's exact precedent for a
 * constrained-parent leaf. `value` deliberately left unset here (a bare,
 * standalone Option has no meaningful default) — the starter set below
 * gives each of its three Options a real, distinct value instead.
 */
export function createOptionNode(): EditorElementNode {
  return { id: generateNodeId("option"), tag: "option", text: "Option" };
}

function createStarterOption(text: string, value: string): EditorElementNode {
  return { id: generateNodeId("option"), tag: "option", text, value };
}

/**
 * A newly inserted Select ships with three starter Options — the same
 * "immediately understandable and usable, not an empty shell" reasoning
 * List's own three starter `<li>` items already established (Checkpoint
 * 1.6), built inline on the returned node for the same one-insertion/
 * one-history-entry reason. None starts authored `selected` — an
 * unselected Select simply falls back to the browser's own native
 * "first option" default (see types/select.ts's own doc comment), the
 * same "unset renders the safe native default" convention this app
 * already uses everywhere else.
 */
function createStarterOptions(): EditorElementNode[] {
  return [
    createStarterOption("Option 1", "option-1"),
    createStarterOption("Option 2", "option-2"),
    createStarterOption("Option 3", "option-3"),
  ];
}

/**
 * Select (Checkpoint 1.13) — a genuine `tag: "select"` leaf-ish container
 * (see insertionRules.ts: it accepts only Option children, the same
 * constrained shape ul/ol already established). Deliberately does NOT
 * get Container/Section/Form's flowLayout+spacing structural defaults:
 * unlike those, a Select's children are native `<option>` elements, not
 * flowed boxes — block/flex/grid arrangement has no real rendering
 * effect on them, so leaving flowLayout/spacing unset (natural sizing)
 * matches Input/Textarea's own leaf-like sizing convention instead.
 */
export function createSelectNode(): EditorElementNode {
  return {
    id: generateNodeId("select"),
    tag: "select",
    children: createStarterOptions(),
  };
}

/**
 * A single, freshly-created Header Cell (Checkpoint 1.14) — used both as
 * the Columns control's growth entry for the header row and, with
 * distinct text below, as the starter table's own header row. A
 * text-bearing leaf (see TableCellElement/insertionRules.ts's own doc
 * comments) — no children, matching List Item/Option's exact precedent
 * for a constrained-parent leaf. Simple, generic starter text ("Heading")
 * rather than fake authored data, the same "no fake authored data"
 * convention createInputNode/createOptionNode already follow.
 */
export function createTableHeaderCellNode(): EditorElementNode {
  return { id: generateNodeId("th"), tag: "th", text: "Heading" };
}

/** A single, freshly-created Data Cell (Checkpoint 1.14) — the `<td>` counterpart to createTableHeaderCellNode above, used the same two ways (Columns growth entry, starter table body rows). */
export function createTableDataCellNode(): EditorElementNode {
  return { id: generateNodeId("td"), tag: "td", text: "Cell" };
}

function createStarterHeaderCell(text: string): EditorElementNode {
  return { id: generateNodeId("th"), tag: "th", text };
}

/**
 * A single, freshly-created Table Row (Checkpoint 1.14) — `cellCount`
 * cells of `cellTag`, each built through createTableHeaderCellNode/
 * createTableDataCellNode above (never an inline object literal). Used
 * both by the starter table's body rows and by setTableBodyRowCount's own
 * "append a fresh row matching the current column count" growth path
 * (tableCommands.ts).
 */
export function createTableRowNode(cellTag: "th" | "td", cellCount: number): EditorElementNode {
  const createCell = cellTag === "th" ? createTableHeaderCellNode : createTableDataCellNode;
  return {
    id: generateNodeId("tr"),
    tag: "tr",
    children: Array.from({ length: cellCount }, createCell),
  };
}

/** A single, freshly-created table section (`<thead>`/`<tbody>`/`<tfoot>`) wrapping the given rows — used by the starter table below and by setTableHeaderEnabled/setTableFooterEnabled's own "create the section fresh" path (tableCommands.ts). */
export function createTableSectionNode(tag: "thead" | "tbody" | "tfoot", rows: EditorElementNode[]): EditorElementNode {
  return { id: generateNodeId(tag), tag, children: rows };
}

/**
 * A newly inserted Table ships with a complete, immediately useful
 * starter structure (Checkpoint 1.14) — 3 columns, one header row, two
 * body rows — the same "immediately understandable and usable, not an
 * empty shell" reasoning List's 3 starter `<li>`s and Select's 3 starter
 * Options already established. Every node is an ordinary primitive built
 * through the dedicated cell/row/section factories above, composed
 * inline on the returned node for the same one-insertion/one-history-
 * entry reason those two precedents use. Deliberately does NOT get
 * Container/Section/Form's flowLayout+spacing structural defaults — like
 * Select, a Table's own children are governed by native table layout, not
 * Layoutry's Flow/Flex/Grid (see elementCapabilities.ts's own
 * supportsChildLayout: false override for `table`), so leaving
 * flowLayout/spacing unset matches Select's own leaf-like sizing
 * convention. Header cells get distinct starter text ("Heading 1"/"Heading
 * 2"/"Heading 3") so the starter table reads as genuinely useful at a
 * glance; body cells share the plain "Cell" default createTableDataCellNode
 * already uses — there is no equally short, meaningful way to distinguish
 * "Cell 1" from "Cell 2" the way distinct header labels are meaningful.
 */
export function createTableNode(): EditorElementNode {
  const headerRow: EditorElementNode = {
    id: generateNodeId("tr"),
    tag: "tr",
    children: [
      createStarterHeaderCell("Heading 1"),
      createStarterHeaderCell("Heading 2"),
      createStarterHeaderCell("Heading 3"),
    ],
  };

  return {
    id: generateNodeId("table"),
    tag: "table",
    children: [
      createTableSectionNode("thead", [headerRow]),
      createTableSectionNode("tbody", [createTableRowNode("td", 3), createTableRowNode("td", 3)]),
    ],
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

/**
 * Video (Checkpoint 1.15) — a genuine `tag: "video"` leaf. Deliberately
 * ships with NO src (unlike Image's own fixed placeholder SVG above):
 * there is no equivalent safe, inline, always-available placeholder video
 * the way an inline SVG works for Image, and this checkpoint's brief
 * explicitly rejects injecting a random external video URL. A freshly
 * created Video is understandable via its own Canvas empty-state overlay
 * (MediaGuideOverlay) instead, the same "editor-only hint, not fake
 * authored data" philosophy Table/Select's own starter content
 * deliberately avoids for genuinely unknowable content. `controls`/
 * `autoplay`/`muted`/`loop`/`poster` are all left unset — `controls`
 * still renders as visually present via getVideoControls's own resolver-
 * level fallback (see EditorElementNode.controls's own doc comment); the
 * other three correctly default to "attribute absent," their real HTML
 * default. No flowLayout/spacing (leaf-like sizing, matching every other
 * media/leaf factory in this file).
 */
export function createVideoNode(): EditorElementNode {
  return { id: generateNodeId("video"), tag: "video" };
}

/**
 * Iframe (Checkpoint 1.15) — a genuine `tag: "iframe"` leaf. Ships with a
 * real, neutral, immediately-accessible starter `title` ("Embedded
 * content") rather than leaving it unset — the same reasoning
 * createLinkNode's own DEFAULT_LINK_HREF stamps a concrete "#" rather
 * than leaving `href` unset: an iframe with no title is a real,
 * immediate accessibility gap (screen readers announce iframes by their
 * title), and "Embedded content" is a genuinely correct, non-misleading
 * description of literally any iframe before the user customizes it —
 * see this checkpoint's report for the full reasoning. `src` is left
 * unset for the same "no fake authored data" reason Video's own src is;
 * the empty-state overlay covers the same gap.
 */
export function createIframeNode(): EditorElementNode {
  return { id: generateNodeId("iframe"), tag: "iframe", title: "Embedded content" };
}

/**
 * SVG Foundation (Checkpoint 1.15.5) — a genuine `tag: "svg"` leaf.
 * Ships with an explicit starter Rectangle and a visible accent fill
 * (DEFAULT_SVG_FILL — see types/svg.ts's own doc comment for why this
 * differs from the plain-black fallback an *unset* fill later resolves
 * to) so a freshly-inserted SVG is never a blank, confusing box — this
 * checkpoint's own explicit "why use starter geometry" rationale.
 * svgViewBox/svgStroke/svgStrokeWidth are left unset, resolving to their
 * own documented defaults (0 0 100 100 / no stroke / native width 1) —
 * no synthesized default is stored here beyond kind/fill, the same
 * "only stamp what actually needs a concrete starter value" restraint
 * createLinkNode/createIframeNode's own stamped defaults already use.
 */
export function createSvgNode(): EditorElementNode {
  return { id: generateNodeId("svg"), tag: "svg", svgKind: "rectangle", svgFill: DEFAULT_SVG_FILL };
}

/**
 * Dialog Foundation (Checkpoint 1.15.6.9) — a genuine `tag: "dialog"`
 * leaf, childable like any other container primitive (empty `children`,
 * same starting shape createContainerNode uses). `initialPreviewVisibility:
 * "hidden"` is set here too, not only on createModalNode's own Dialog
 * (interactionCompositions.ts) — a bare, unwired Dialog primitive with no
 * authored default would otherwise call `showModal()` the INSTANT Preview
 * begins (see DialogElement's own doc comment: mounting during Preview
 * with nothing marking it hidden IS the "should be open" signal), an
 * honestly surprising result for a primitive the user hasn't wired any
 * trigger to yet. "Closed until something opens it" is this tag's own
 * inherent nature, independent of whether it's used bare or as part of a
 * larger composition — the same default createDropdownButtonNode's own
 * menu Container already established for exactly this reason.
 */
export function createDialogNode(): EditorElementNode {
  return { id: generateNodeId("dialog"), tag: "dialog", children: [], initialPreviewVisibility: "hidden" };
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
  select: createSelectNode,
  table: createTableNode,
  video: createVideoNode,
  iframe: createIframeNode,
  svg: createSvgNode,
  dialog: createDialogNode,
  primaryButton: createPrimaryButtonNode,
  secondaryButton: createSecondaryButtonNode,
  outlineButton: createOutlineButtonNode,
  ghostButton: createGhostButtonNode,
  buttonGroup: createButtonGroupNode,
  dropdownButton: createDropdownButtonNode,
  basicNavbar: createBasicNavbarNode,
  navbarWithCta: createNavbarWithCtaNode,
  centeredNavbar: createCenteredNavbarNode,
  breadcrumbs: createBreadcrumbsNode,
  pagination: createPaginationNode,
  sidebarNavigation: createSidebarNavigationNode,
  basicCard: createBasicCardNode,
  imageCard: createImageCardNode,
  horizontalCard: createHorizontalCardNode,
  profileCard: createProfileCardNode,
  featureCard: createFeatureCardNode,
  pricingCard: createPricingCardNode,
  labeledTextField: createLabeledTextFieldNode,
  searchBar: createSearchBarNode,
  newsletterSignup: createNewsletterSignupNode,
  contactForm: createContactFormNode,
  loginForm: createLoginFormNode,
  labeledSelectField: createLabeledSelectFieldNode,
  badge: createBadgeNode,
  avatar: createAvatarNode,
  avatarWithText: createAvatarWithTextNode,
  statCard: createStatCardNode,
  metadataRow: createMetadataRowNode,
  collapsible: createCollapsibleNode,
  modal: createModalNode,
  infoAlert: createInfoAlertNode,
  successAlert: createSuccessAlertNode,
  warningAlert: createWarningAlertNode,
  errorAlert: createErrorAlertNode,
  dismissibleAlert: createDismissibleAlertNode,
  manualToast: createManualToastNode,
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
  select: { width: 200, height: 40 },
  table: { width: 480, height: 200 },
  video: { width: 400, height: 225 },
  iframe: { width: 400, height: 300 },
  svg: { width: 200, height: 200 },
  dialog: { width: 320, height: 200 },
  primaryButton: { width: 120, height: 44 },
  secondaryButton: { width: 120, height: 44 },
  outlineButton: { width: 120, height: 44 },
  ghostButton: { width: 120, height: 44 },
  buttonGroup: { width: 280, height: 48 },
  dropdownButton: { width: 200, height: 160 },
  basicNavbar: { width: 480, height: 64 },
  navbarWithCta: { width: 520, height: 64 },
  centeredNavbar: { width: 480, height: 64 },
  breadcrumbs: { width: 360, height: 40 },
  pagination: { width: 320, height: 48 },
  sidebarNavigation: { width: 220, height: 220 },
  basicCard: { width: 280, height: 180 },
  imageCard: { width: 280, height: 280 },
  horizontalCard: { width: 420, height: 160 },
  profileCard: { width: 240, height: 260 },
  featureCard: { width: 260, height: 120 },
  pricingCard: { width: 260, height: 320 },
  labeledTextField: { width: 240, height: 70 },
  searchBar: { width: 320, height: 44 },
  newsletterSignup: { width: 360, height: 44 },
  contactForm: { width: 360, height: 420 },
  loginForm: { width: 340, height: 400 },
  labeledSelectField: { width: 240, height: 70 },
  badge: { width: 90, height: 28 },
  avatar: { width: 64, height: 64 },
  avatarWithText: { width: 220, height: 56 },
  statCard: { width: 220, height: 130 },
  metadataRow: { width: 260, height: 32 },
  collapsible: { width: 260, height: 100 },
  modal: { width: 320, height: 160 },
  infoAlert: { width: 320, height: 100 },
  successAlert: { width: 320, height: 100 },
  warningAlert: { width: 320, height: 100 },
  errorAlert: { width: 320, height: 100 },
  dismissibleAlert: { width: 360, height: 100 },
  manualToast: { width: 280, height: 120 },
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
  select: "select",
  table: "table",
  video: "video",
  iframe: "iframe",
  svg: "svg",
  dialog: "dialog",
};

/** Falls back to a generic size for a tag with no InsertableElementType entry (e.g. a pasted/duplicated node whose tag isn't one of the five catalog types). */
export function getDefaultFreeElementSize(tag: string): { width: number; height: number } {
  const type = INSERTABLE_TYPE_BY_TAG[tag];
  return type ? DEFAULT_FREE_ELEMENT_SIZE[type] : DEFAULT_FREE_SIZE_FALLBACK;
}
