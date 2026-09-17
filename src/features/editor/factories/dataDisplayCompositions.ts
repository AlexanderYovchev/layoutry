/**
 * Components -> Data Display (Checkpoint 1.15.6.6) — the fourth Components
 * family, following the exact composition architecture Buttons (1.15.6.2),
 * Navigation (1.15.6.3), Cards & Content (1.15.6.4), and Forms & Inputs
 * (1.15.6.5) already established. Every factory here returns an ordinary
 * tree of existing primitives (div/img/p) with concrete starter style
 * FIELDS authored directly — no `badge`/`avatar`/`statCard`/`dataDisplay`
 * tag, no `badgeVariant`/`statType`/`displayVariant` field of any kind.
 *
 * Catalog decision (audited against the actual pre-existing toolbar, not
 * assumed from the brief): the real Data Display placeholders were exactly
 * Badge and Avatar (creationToolbarCategories.ts's own "data-display"
 * section, pre-checkpoint) — no Avatar with Text/Stat Card/Progress/
 * Metadata placeholders existed yet. Implemented: Badge, Avatar, Avatar
 * with Text, Stat Card, Metadata Row — a coherent five-component family
 * covering the brief's own candidate list without inflating it into
 * color/status variants of the same shape. Progress Display is
 * deliberately DEFERRED: this app has no genuine `<progress>` primitive
 * (grepped — none exists), and the pre-existing toolbar itself never
 * carried a Progress placeholder the way it did for Badge/Avatar, so
 * neither of the brief's own two "implement it anyway" conditions (a real
 * primitive, or a clear pre-existing toolbar intent) is met. A purely
 * visual nested-div "track/fill" composition was considered and rejected
 * for the same reason Feature Card's icon was deferred in 1.15.6.4: it
 * would misrepresent inert, non-interactive authored boxes as if they
 * carried real progress semantics.
 *
 * Two reused, already-established mechanisms, no new ones:
 *
 * 1. applyBorderRadiusPreset (types/borderRadius.ts) — a clean,
 *    no-existing-state-required factory exactly like applyShadowPreset
 *    (reused by Cards) — supplies Badge's "pill" (9999px) and Avatar's
 *    "circle" (50%) shapes directly from the existing generic Border
 *    Radius system. No clip-path, no shape-specific field.
 * 2. FlexChildSettings (`node.flexChild`) — the exact mechanism Horizontal
 *    Card (1.15.6.4) used for its fixed-width media column now gives
 *    Avatar with Text's Image a fixed-size avatar column beside a growing
 *    text column, never touching `node.dimensions`.
 *
 * A genuine, no-new-architecture finding worth recording: Badge's root
 * needs no "fit-content"/inline-flex hack to render as a compact pill
 * rather than a full-width bar. ContainerElement's default Block mode
 * (resolveFlowLayoutStyle.ts) renders as `flex-direction: column;
 * align-items: flex-start` — the cross axis (width) is never stretched —
 * so ANY div-based composition dropped into the ordinary Block-flow
 * default (the page root, a Container, a Section) already hugs its own
 * content width with zero extra styling. This is the exact same reason
 * Basic Card/Stat Card/etc. never needed a width override either; it is
 * only a DELIBERATE user choice (an explicit Flex-Column parent with
 * "stretch" alignment) that would ever stretch Badge full-width, which is
 * ordinary, expected Flex behavior, not a defect.
 *
 * Stat Card's value deliberately stays a Paragraph, not a Heading (see
 * createStatCardNode below) — the same "prefer semantic correctness over
 * visual convenience" principle Cards' own Feature Card audit already
 * established for headings. Its "+8.2%" supporting text stays a neutral
 * authored color rather than a green "success" color — a deliberate
 * choice, not an oversight — to avoid visually implying live trend/state
 * semantics this checkpoint explicitly does not add (see its own doc
 * comment below).
 */

import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { applyBorderRadiusPreset } from "@/features/editor/types/borderRadius";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BorderSettings } from "@/features/editor/types/border";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlexContainerSettings } from "@/features/editor/types/flowLayout";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import { ZERO_EDGES } from "@/features/editor/types/spacing";
import type { TypographySettings } from "@/features/editor/types/typography";

function flexRow(gap: number, justifyContent: FlexContainerSettings["justifyContent"], alignItems: FlexContainerSettings["alignItems"]): FlexContainerSettings {
  return { direction: "row", wrap: "nowrap", justifyContent, alignItems, rowGap: gap, columnGap: gap };
}

function flexColumn(gap: number, alignItems: FlexContainerSettings["alignItems"] = "stretch"): FlexContainerSettings {
  return { direction: "column", wrap: "nowrap", justifyContent: "start", alignItems, rowGap: gap, columnGap: gap };
}

function paragraph(text: string, typography?: TypographySettings): EditorElementNode {
  return { id: generateNodeId("p"), tag: "p", text, typography };
}

// ---------------------------------------------------------------------------
// Badge (Part C)
// ---------------------------------------------------------------------------

const BADGE_BACKGROUND: BackgroundSettings = { color: "#f4f4f5" };
const BADGE_BORDER: BorderSettings = {
  top: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  right: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  bottom: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  left: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
};
const BADGE_RADIUS: BorderRadiusSettings | undefined = applyBorderRadiusPreset("pill");
const BADGE_PADDING: ElementSpacing = { margin: ZERO_EDGES, padding: { top: 4, right: 10, bottom: 4, left: 10 } };
const BADGE_TEXT_TYPOGRAPHY: TypographySettings = { fontSize: { value: 12, unit: "px" }, fontWeight: 600, color: "#3f3f46" };

/**
 * div > p (Part C/D/section 11) — the smallest useful Data Display
 * composition. A Container wrapper is used (over a bare Paragraph alone)
 * specifically so the badge gets its own editable box (background/border/
 * pill radius/padding) while the Paragraph stays independently selectable
 * and text-editable (section 10's own stated preference). No `<badge>`
 * tag, no `pill: true`/`badgeVariant` field — the pill shape is ordinary
 * authored Border Radius (applyBorderRadiusPreset, section 13).
 */
export function createBadgeNode(): EditorElementNode {
  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: flexRow(0, "center", "center") },
    background: BADGE_BACKGROUND,
    border: BADGE_BORDER,
    borderRadius: BADGE_RADIUS,
    spacing: BADGE_PADDING,
    children: [paragraph("Badge", BADGE_TEXT_TYPOGRAPHY)],
  };
}

// ---------------------------------------------------------------------------
// Avatar (Part D)
// ---------------------------------------------------------------------------

const AVATAR_RADIUS: BorderRadiusSettings | undefined = applyBorderRadiusPreset("circle");

/**
 * A single Image node (Part D, section 17) — audited and confirmed a
 * Container wrapper adds no real value here (section 16): Avatar is
 * entirely an ordinary Image configured visually (1:1 aspect ratio,
 * object-fit cover, circular Border Radius), the same wrapper-owns-
 * layout/inner-`<img>`-owns-object-fit split every other Image usage in
 * this app already has (see ImageElement.tsx's own doc comment) — nothing
 * here adds a second rendering path. No `tag: "avatar"`, no `avatarSrc`/
 * `avatarSize`/`avatarShape` field (section 18) — shape is ordinary Border
 * Radius (section 19), fit is the existing `mediaFit.objectFit` field
 * (section 20). Per section 47, the composition root IS the Image itself,
 * so insertion selects the Image directly.
 */
export function createAvatarNode(): EditorElementNode {
  return {
    id: generateNodeId("img"),
    tag: "img",
    aspectRatio: { mode: "ratio", width: 1, height: 1 },
    mediaFit: { objectFit: "cover" },
    borderRadius: AVATAR_RADIUS,
  };
}

// ---------------------------------------------------------------------------
// Avatar with Text (Part E)
// ---------------------------------------------------------------------------

const IDENTITY_NAME_TYPOGRAPHY: TypographySettings = { fontWeight: 600, color: "#18181b" };
const IDENTITY_SUBTITLE_TYPOGRAPHY: TypographySettings = { fontSize: { value: 13, unit: "px" }, color: "#71717a" };

/**
 * div (Flex Row) > img, div (Flex Column) > p, p (Part E, section 22) —
 * root Flex Row per section 22; the avatar Image gets the exact same
 * fixed-column FlexChildSettings mechanism Horizontal Card's media column
 * already established (1.15.6.4) — `flexChild: { grow: 0, shrink: 0,
 * basis: 44 }` plus a 1:1 aspect ratio and circular radius — so it renders
 * as a small, fixed-size avatar beside a growing text column
 * (`flexChild: { grow: 1, shrink: 1, basis: "auto" }`), never touching
 * `node.dimensions`.
 *
 * Name uses a Paragraph, not a Heading (section 24): a person's name in an
 * identity strip is not a document heading — it has no place in the page's
 * outline hierarchy — so emphasis comes from authored `typography.
 * fontWeight`, exactly as the brief instructs ("use typography to create
 * emphasis instead of abusing semantic heading levels").
 *
 * No `user`/`profile`/`username`/`role`/`avatarUrl`/`userId` field anywhere
 * (section 25) — "Alex Morgan"/"Product Designer" are plain authored text
 * on ordinary Paragraph nodes, and the Image's own ordinary `src` is the
 * only image-identifying field, matching Profile Card's own precedent
 * (1.15.6.4).
 */
export function createAvatarWithTextNode(): EditorElementNode {
  const avatar: EditorElementNode = {
    id: generateNodeId("img"),
    tag: "img",
    aspectRatio: { mode: "ratio", width: 1, height: 1 },
    mediaFit: { objectFit: "cover" },
    borderRadius: AVATAR_RADIUS,
    flexChild: { grow: 0, shrink: 0, basis: 44, alignSelf: "center" },
  };
  const textGroup: EditorElementNode = {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: flexColumn(2) },
    flexChild: { grow: 1, shrink: 1, basis: "auto", alignSelf: "stretch" },
    children: [
      paragraph("Alex Morgan", IDENTITY_NAME_TYPOGRAPHY),
      paragraph("Product Designer", IDENTITY_SUBTITLE_TYPOGRAPHY),
    ],
  };
  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: flexRow(12, "start", "center") },
    children: [avatar, textGroup],
  };
}

// ---------------------------------------------------------------------------
// Stat Card (Part F)
// ---------------------------------------------------------------------------

const STAT_CARD_BACKGROUND: BackgroundSettings = { color: "#ffffff" };
const STAT_CARD_BORDER: BorderSettings = {
  top: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  right: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  bottom: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  left: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
};
const STAT_CARD_RADIUS: BorderRadiusSettings = {
  topLeft: { value: 8, unit: "px" },
  topRight: { value: 8, unit: "px" },
  bottomRight: { value: 8, unit: "px" },
  bottomLeft: { value: 8, unit: "px" },
};
const STAT_CARD_PADDING: ElementSpacing = { margin: ZERO_EDGES, padding: { top: 20, right: 20, bottom: 20, left: 20 } };
const STAT_LABEL_TYPOGRAPHY: TypographySettings = { fontSize: { value: 13, unit: "px" }, color: "#71717a" };
const STAT_VALUE_TYPOGRAPHY: TypographySettings = { fontSize: { value: 28, unit: "px" }, fontWeight: 700, color: "#18181b" };
/**
 * Deliberately a NEUTRAL gray, not a "success green" (section 29's own
 * "consider keeping it neutral to avoid implying dynamic semantics") —
 * this is ordinary authored `typography.color`, not a `trend`/`status`
 * field, and a neutral tone keeps that unambiguous: nothing here implies
 * the number is live or the trend is currently positive.
 */
const STAT_SUPPORTING_TYPOGRAPHY: TypographySettings = { fontSize: { value: 13, unit: "px" }, color: "#71717a" };

/**
 * div > p, p, p (Part F, section 27) — Container wrapper styled like an
 * ordinary card surface (background/border/radius/padding, matching Cards'
 * own established look) around three plain Paragraphs. The value ("12,450")
 * stays a Paragraph rather than a Heading (see this file's own top comment)
 * — emphasis is authored typography, not semantic level. No `statValue`/
 * `statTrend`/`statLabel` field anywhere (section 28); all three lines are
 * ordinary text content.
 */
export function createStatCardNode(): EditorElementNode {
  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: flexColumn(4) },
    background: STAT_CARD_BACKGROUND,
    border: STAT_CARD_BORDER,
    borderRadius: STAT_CARD_RADIUS,
    spacing: STAT_CARD_PADDING,
    children: [
      paragraph("Total Visitors", STAT_LABEL_TYPOGRAPHY),
      paragraph("12,450", STAT_VALUE_TYPOGRAPHY),
      paragraph("+8.2% from last month", STAT_SUPPORTING_TYPOGRAPHY),
    ],
  };
}

// ---------------------------------------------------------------------------
// Metadata Row (Part H)
// ---------------------------------------------------------------------------

const METADATA_KEY_TYPOGRAPHY: TypographySettings = { fontWeight: 600, color: "#3f3f46" };
const METADATA_VALUE_TYPOGRAPHY: TypographySettings = { color: "#18181b" };

/**
 * div (Flex Row, justify space-between) > p, p (Part H, section 35) — the
 * existing `JustifyContent` union already includes "space-between"
 * (types/flowLayout.ts), so this needed zero new layout capability. No
 * `key`/`value`/`metadata`/`field`/`property` field (section 36) — both
 * sides are ordinary Paragraph text.
 */
export function createMetadataRowNode(): EditorElementNode {
  return {
    id: generateNodeId("div"),
    tag: "div",
    flowLayout: { display: "flex", flex: flexRow(12, "space-between", "center") },
    children: [
      paragraph("Status", METADATA_KEY_TYPOGRAPHY),
      paragraph("Active", METADATA_VALUE_TYPOGRAPHY),
    ],
  };
}
