/**
 * Components -> Cards & Content (Checkpoint 1.15.6.4) — the third
 * Components family, following the exact composition architecture Buttons
 * (1.15.6.2) and Navigation (1.15.6.3) already established. Every factory
 * here returns an ordinary tree of existing primitives (div/img/h3/p/a/
 * button/ul/li) with concrete starter style FIELDS authored directly — no
 * `card`/`cardComponent`/`profileCard` tag, no `cardVariant`/`cardType`
 * field of any kind. The existing composition architecture (createElementNode
 * /FACTORIES_BY_TYPE/DEFAULT_FREE_ELEMENT_SIZE, one insertElement call per
 * composition) needed zero changes — the same story Navigation already
 * proved for the second family.
 *
 * Two genuinely new findings surfaced auditing Cards specifically (both
 * documented here, matching this checkpoint's own "explain decisions"
 * requirement, neither is a hack):
 *
 * 1. HeadingElement's own "text-3xl font-semibold" class is unconditional
 *    across EVERY heading level (h1-h6 alike — see HeadingElement.tsx,
 *    which renders every level through the exact same class string with
 *    no per-level size scaling at all). An <h3> Card title would otherwise
 *    render at full h1-sized text — the same "unconditional chrome
 *    default" pattern buttonCompositions.ts already documented for
 *    Button/Link, now confirmed for Heading too. Every Card title below
 *    explicitly authors a smaller `typography.fontSize`/`fontWeight`.
 * 2. ImageElement's own "h-40" placeholder-height class only gets out of
 *    the way once `node.aspectRatio?.mode === "ratio"` (see that
 *    component's own doc comment) — which also means it's the escape
 *    valve this checkpoint needed for Horizontal Card's fixed-width media
 *    column: an explicit `aspectRatio` on the Image is what lets its
 *    height come from CSS math against the `flexChild.basis` width
 *    instead of a fixed, unrelated 160px chrome default.
 *
 * Reuses createPrimaryButtonNode (buttonCompositions.ts) directly for
 * Pricing Card's "Choose Plan" action and applyShadowPreset (boxShadow.ts)
 * for every Card's starter shadow — no re-authored duplicate of either.
 */

import { createPrimaryButtonNode } from "@/features/editor/factories/buttonCompositions";
import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { applyShadowPreset } from "@/features/editor/types/boxShadow";
import { DEFAULT_LINK_HREF } from "@/features/editor/types/link";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BorderSettings } from "@/features/editor/types/border";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlexContainerSettings } from "@/features/editor/types/flowLayout";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import { ZERO_EDGES } from "@/features/editor/types/spacing";
import type { TypographySettings } from "@/features/editor/types/typography";

const CARD_BACKGROUND: BackgroundSettings = { color: "#ffffff" };
const CARD_BORDER: BorderSettings = {
  top: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  right: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  bottom: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  left: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
};
const CARD_RADIUS: BorderRadiusSettings = {
  topLeft: { value: 8, unit: "px" },
  topRight: { value: 8, unit: "px" },
  bottomRight: { value: 8, unit: "px" },
  bottomLeft: { value: 8, unit: "px" },
};
const CARD_PADDING: ElementSpacing = { margin: ZERO_EDGES, padding: { top: 20, right: 20, bottom: 20, left: 20 } };
const CARD_TITLE_TYPOGRAPHY: TypographySettings = { fontSize: { value: 18, unit: "px" }, fontWeight: 600, color: "#18181b" };
const CARD_LINK_TYPOGRAPHY: TypographySettings = { color: "#18181b", fontWeight: 600 };

/** A fresh shadow layer list per Card instance (never a shared module constant) — ShadowLayer carries its own `id`, and this codebase's own "every node gets its own fresh id" convention (verified in every composition's own test file) extends to a node's nested ids too. */
function cardShadow() {
  return applyShadowPreset("small");
}

function cardColumnFlex(gap: number): FlexContainerSettings {
  return { direction: "column", wrap: "nowrap", justifyContent: "start", alignItems: "stretch", rowGap: gap, columnGap: gap };
}

function cardTitle(text: string): EditorElementNode {
  return { id: generateNodeId("h3"), tag: "h3", text, typography: CARD_TITLE_TYPOGRAPHY };
}

function cardBody(text: string): EditorElementNode {
  return { id: generateNodeId("p"), tag: "p", text };
}

/**
 * "Learn More"/"View Profile" (Checkpoint 1.15.6.4, section 86): a Link,
 * not a Button — both represent navigating to more content (a details
 * page, a profile page), which is exactly what `href` represents, the same
 * "a navigation destination is usually a Link" reasoning Pagination's own
 * numbered pages used in Checkpoint 1.15.6.3. Pricing Card's "Choose Plan"
 * (below, via createPrimaryButtonNode) is the deliberate counter-example:
 * an in-place action, not a navigation destination, so it stays a Button.
 */
function cardLink(text: string): EditorElementNode {
  return { id: generateNodeId("a"), tag: "a", text, href: DEFAULT_LINK_HREF, typography: CARD_LINK_TYPOGRAPHY };
}

/** Shared root shape for every Card below — a real, visible-but-neutral surface (white background, subtle border, modest radius, a small drop shadow) rather than a bare unstyled div, matching this checkpoint's own "usable immediately, not a brand statement" instruction. */
function cardRoot(flex: FlexContainerSettings, spacing: ElementSpacing, children: EditorElementNode[]): EditorElementNode {
  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex },
    background: CARD_BACKGROUND,
    border: CARD_BORDER,
    borderRadius: CARD_RADIUS,
    boxShadow: cardShadow(),
    spacing,
    children,
  };
}

/**
 * div > h3, p, a (Checkpoint 1.15.6.4, Part C) — the smallest useful
 * content Card. Root is an ordinary `div` (section 11: Article stays a
 * separate, specifically-article-oriented primitive; Basic Card is
 * deliberately generic). No `dimensions` is stamped (section 13 — see
 * ElementDimensions's own "user's own resize intent" doc comment; a
 * factory stamping it would fake a manual resize that never happened, the
 * same convention Sidebar Navigation already followed).
 */
export function createBasicCardNode(): EditorElementNode {
  return cardRoot(cardColumnFlex(12), CARD_PADDING, [
    cardTitle("Card Title"),
    cardBody("Card description goes here. Replace this text with your own content."),
    cardLink("Learn More"),
  ]);
}

const CARD_MEDIA_FLEX = cardColumnFlex(0);
const CARD_CONTENT_PADDING = CARD_PADDING;

/**
 * Card root's own padding is deliberately left at zero here, with a
 * nested content Container carrying the real padding instead (Checkpoint
 * 1.15.6.4, section 15) — not nesting for its own sake, but because the
 * root genuinely needs two different padding regions a single flat
 * container cannot express: the Image should bleed flush to the card's
 * own edges (so its top corners sit exactly at the root's rounded
 * border), while the text content below needs real internal padding.
 * `display.overflow: "hidden"` on the root clips the Image's own square
 * corners to the root's rounded border — without it the Image (a plain
 * rectangle) would visibly poke past the rounded corners.
 */
function mediaCardRoot(flex: FlexContainerSettings, media: EditorElementNode, content: EditorElementNode[]): EditorElementNode {
  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex },
    background: CARD_BACKGROUND,
    border: CARD_BORDER,
    borderRadius: CARD_RADIUS,
    boxShadow: cardShadow(),
    display: { overflow: "hidden" },
    spacing: { margin: ZERO_EDGES, padding: ZERO_EDGES },
    children: [
      media,
      {
        id: generateNodeId("div"),
        tag: "div",
        flowLayout: { display: "flex", flex: cardColumnFlex(12) },
        spacing: CARD_CONTENT_PADDING,
        children: content,
      },
    ],
  };
}

/**
 * div > (img, div > h3, p, a) (Checkpoint 1.15.6.4, Part D) — the nested
 * content-Container structure (section 15), chosen over a flat
 * `div > img, h3, p, a` tree for the padding reason mediaCardRoot's own
 * doc comment explains. The Image keeps the exact wrapper/native-`<img>`
 * ownership split every other Image usage in this app already has —
 * `aspectRatio`/`mediaFit` are both ordinary fields on the SAME Image
 * node ImageElement.tsx already resolves through its existing wrapper-
 * owns-layout / inner-img-owns-object-fit split (see that component's own
 * doc comment); nothing here adds a second rendering path or blurs that
 * boundary. `objectFit: "cover"` is this checkpoint's own explicit
 * recommendation for Card media (section 17); 16:9 is a common, safe
 * starter ratio for card media (section 18) — no src is stamped (this app
 * has no asset picker; ImageElement's own icon-only placeholder covers an
 * empty `src`, the same as every other Image usage).
 */
export function createImageCardNode(): EditorElementNode {
  const image: EditorElementNode = {
    id: generateNodeId("img"),
    tag: "img",
    aspectRatio: { mode: "ratio", width: 16, height: 9 },
    mediaFit: { objectFit: "cover" },
  };
  return mediaCardRoot(CARD_MEDIA_FLEX, image, [
    cardTitle("Card Title"),
    cardBody("Card description goes here. Replace this text with your own content."),
    cardLink("Learn More"),
  ]);
}

/**
 * div > (img, div > h3, p, a), Flex Row (Checkpoint 1.15.6.4, Part E) — a
 * fixed-width media column (`flexChild: { grow: 0, shrink: 0, basis: 160 }`
 * on the Image) beside a flexible content Container (`flexChild: { grow: 1,
 * shrink: 1, basis: "auto" }`), both ordinary, pre-existing per-child Flex
 * settings (see types/flowLayout.ts's own FlexChildSettings — the exact
 * Inspector "Flex item" Grow/Shrink/Basis controls, not a new mechanism).
 * This is a deliberate, explicit pixel choice for the media column
 * (section 21's own "avoid brittle fixed pixel assumptions where
 * possible" is about not inventing a NEW sizing architecture — this reuses
 * the one that already exists). The Image also gets a 1:1 `aspectRatio`
 * (a square thumbnail) specifically so ImageElement's own unconditional
 * "h-40" chrome class gets out of the way (see this file's own top
 * comment, finding #2) — without it, the fixed 160px flex-basis width
 * would pair with an unrelated fixed 160px chrome height rather than a
 * deliberately authored ratio.
 */
export function createHorizontalCardNode(): EditorElementNode {
  const image: EditorElementNode = {
    id: generateNodeId("img"),
    tag: "img",
    aspectRatio: { mode: "ratio", width: 1, height: 1 },
    mediaFit: { objectFit: "cover" },
    flexChild: { grow: 0, shrink: 0, basis: 160, alignSelf: "center" },
  };
  const content: EditorElementNode = {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: cardColumnFlex(12) },
    spacing: CARD_CONTENT_PADDING,
    flexChild: { grow: 1, shrink: 1, basis: "auto", alignSelf: "stretch" },
    children: [
      cardTitle("Card Title"),
      cardBody("Card description goes here. Replace this text with your own content."),
      cardLink("Learn More"),
    ],
  };
  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "stretch", rowGap: 0, columnGap: 0 } },
    background: CARD_BACKGROUND,
    border: CARD_BORDER,
    borderRadius: CARD_RADIUS,
    boxShadow: cardShadow(),
    display: { overflow: "hidden" },
    spacing: { margin: ZERO_EDGES, padding: ZERO_EDGES },
    children: [image, content],
  };
}

const PROFILE_AVATAR_RADIUS: BorderRadiusSettings = {
  topLeft: { value: 50, unit: "%" },
  topRight: { value: 50, unit: "%" },
  bottomRight: { value: 50, unit: "%" },
  bottomLeft: { value: 50, unit: "%" },
};
const PROFILE_CENTER_TYPOGRAPHY: TypographySettings = { ...CARD_TITLE_TYPOGRAPHY, textAlign: "center" };
const PROFILE_ROLE_TYPOGRAPHY: TypographySettings = { textAlign: "center" };

/**
 * div > img, h3, p, a (Checkpoint 1.15.6.4, Part F) — visual content only,
 * no user-account runtime widget (section 23): "Alex Morgan"/"Product
 * Designer" are plain authored text, and the avatar is an ordinary Image
 * (no `Avatar`/`ProfileImage` primitive, section 24). The circular look
 * comes entirely from ordinary Border Radius (50% on all four corners,
 * section 25) plus a 1:1 aspect ratio, applied directly on the Image
 * node's own existing fields — no Avatar-specific rendering path. The
 * Image's unconditional "w-full" class (see ImageElement.tsx) fills the
 * card's own padded content width, which is what actually makes it read
 * as a normal "large circular avatar" profile-card layout, not a
 * limitation — no explicit width needed. No profile/user data model, no
 * `avatarUrl` field beyond the Image's own ordinary `src` (section 26).
 */
export function createProfileCardNode(): EditorElementNode {
  const avatar: EditorElementNode = {
    id: generateNodeId("img"),
    tag: "img",
    aspectRatio: { mode: "ratio", width: 1, height: 1 },
    mediaFit: { objectFit: "cover" },
    borderRadius: PROFILE_AVATAR_RADIUS,
  };
  const name: EditorElementNode = { id: generateNodeId("h3"), tag: "h3", text: "Alex Morgan", typography: PROFILE_CENTER_TYPOGRAPHY };
  const role: EditorElementNode = { id: generateNodeId("p"), tag: "p", text: "Product Designer", typography: PROFILE_ROLE_TYPOGRAPHY };
  const flex: FlexContainerSettings = { direction: "column", wrap: "nowrap", justifyContent: "start", alignItems: "center", rowGap: 12, columnGap: 12 };
  return cardRoot(flex, CARD_PADDING, [avatar, name, role, cardLink("View Profile")]);
}

/**
 * div > h3, p (Checkpoint 1.15.6.4, Part G) — deliberately just Heading +
 * Paragraph, per this checkpoint's own default recommendation (section
 * 29). A generic starter SVG (createSvgNode's own default rectangle) was
 * audited and rejected: it would render as a plain colored rectangle, not
 * a meaningful feature icon — inserting one would read as a confusing
 * placeholder box, arguably worse than omitting it entirely, not a
 * genuine improvement. A real, useful Feature Card icon needs authored
 * icon geometry this app has no tooling to auto-generate (SVG Drawing
 * Mode is a deliberate manual-drawing tool, not a "sensible icon default"
 * generator). Deferred until a real authored Icon architecture exists,
 * matching Checkpoint 1.15.6.3's own Mobile Navbar deferral precedent for
 * the identical "no Icon system yet" reason.
 */
export function createFeatureCardNode(): EditorElementNode {
  return cardRoot(cardColumnFlex(8), CARD_PADDING, [
    cardTitle("Fast & Flexible"),
    cardBody("Ship polished layouts in minutes with a visual workflow built for speed."),
  ]);
}

const PRICE_TYPOGRAPHY: TypographySettings = { fontSize: { value: 36, unit: "px" }, fontWeight: 700, color: "#18181b" };
const BILLING_PERIOD_TYPOGRAPHY: TypographySettings = { color: "#71717a" };
const PRICING_LIST_FLEX: FlexContainerSettings = { direction: "column", wrap: "nowrap", justifyContent: "start", alignItems: "stretch", rowGap: 6, columnGap: 6 };

function pricingFeature(text: string): EditorElementNode {
  return { id: generateNodeId("li"), tag: "li", text };
}

/**
 * div > h3("Starter"), h3("$19"), p("per month"), ul > li x3, button
 * (Checkpoint 1.15.6.4, Part H) — static authored content only, no
 * `price`/`currency`/`billingPeriod`/`features`/`pricingPlan` field
 * anywhere (section 31): the plan name and the price are both plain `h3`
 * text nodes (two headings at the same semantic level, differing only in
 * authored `typography.fontSize`/`fontWeight` — a deliberate, ordinary use
 * of "differences through authored CSS, not persistent identity," the
 * exact principle this checkpoint's own section 3 states). Feature list
 * uses genuine `ul > li` semantics (section 32) rather than three loose
 * Paragraphs — List Item already supports plain text-bearing leaves
 * cleanly, and a real list is the semantically stronger choice for a set
 * of parallel feature labels. "Choose Plan" reuses createPrimaryButtonNode
 * (section 7's own explicit ask) — an in-place action, not a navigation
 * destination, so it stays a Button (see cardLink's own doc comment for
 * the Link-side reasoning this contrasts with). No "Popular" badge —
 * kept out per section 33's own explicit instruction not to overcomplicate
 * the first Pricing Card.
 */
export function createPricingCardNode(): EditorElementNode {
  const list: EditorElementNode = {
    id: generateNodeId("ul"),
    tag: "ul",
    flowLayout: { display: "flex", flex: PRICING_LIST_FLEX },
    spacing: { margin: ZERO_EDGES, padding: ZERO_EDGES },
    children: [pricingFeature("Feature one"), pricingFeature("Feature two"), pricingFeature("Feature three")],
  };
  const cta = createPrimaryButtonNode();
  cta.text = "Choose Plan";
  return cardRoot(cardColumnFlex(12), { margin: ZERO_EDGES, padding: { top: 24, right: 24, bottom: 24, left: 24 } }, [
    cardTitle("Starter"),
    { id: generateNodeId("h3"), tag: "h3", text: "$19", typography: PRICE_TYPOGRAPHY },
    { id: generateNodeId("p"), tag: "p", text: "per month", typography: BILLING_PERIOD_TYPOGRAPHY },
    list,
    cta,
  ]);
}
