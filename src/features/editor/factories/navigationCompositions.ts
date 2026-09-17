/**
 * Components -> Navigation (Checkpoint 1.15.6.3) — the second Components
 * family, following the exact composition architecture Checkpoint 1.15.6.2
 * established for Buttons: every factory here returns an ordinary tree of
 * existing primitives (nav/a/button/p) with concrete starter style FIELDS
 * authored directly — no `navigationVariant` flag, no proprietary
 * `navbarComponent`/`breadcrumbComponent`/`paginationComponent` tag, no new
 * EditorElementNode field of any kind. `nav` is already a genuine,
 * unconstrained container (see insertionRules.ts's CONTAINER_TAGS — it is
 * NOT in ALLOWED_CHILD_TAGS, so it accepts any non-constrained child, which
 * `a`/`button`/`p` all are), so every composition below needed zero new
 * architecture — the same "compositions reuse ordinary insertion/history/
 * duplication for free" story buttonCompositions.ts already proved.
 *
 * Two real, pre-existing limitations surfaced auditing this family (both
 * documented here rather than worked around, per this checkpoint's own
 * brief not to introduce one-off hacks):
 *
 * 1. LinkElement's own Tailwind classes ("underline underline-offset-2
 *    text-blue-600") are unconditional, same as ButtonElement's dark chrome
 *    (see buttonCompositions.ts's own top comment) — but unlike Button's
 *    background/color, there is no `textDecoration` field anywhere in the
 *    style model (TypographySettings has no such field), so a Link's
 *    underline cannot be authored off without inventing a new document
 *    field, which is out of this checkpoint's scope. Every Link preset
 *    below overrides `typography.color` for readability against the
 *    starter navbar backgrounds; the underline itself remains, and is a
 *    real, accepted cosmetic limitation (see this checkpoint's own report).
 * 2. Sidebar Navigation's Flex column uses `alignItems: "stretch"` so its
 *    Link children would normally fill the sidebar's width — but
 *    LinkElement's own unconditional `w-fit` class sets an explicit
 *    `width: fit-content`, which wins over flex stretch (stretch only
 *    applies when the cross-axis size is otherwise auto). Sidebar Links
 *    therefore currently size to their own text, not the sidebar's full
 *    width — also documented as a pre-existing Link rendering choice, not
 *    something this checkpoint's factories can fix without touching
 *    LinkElement itself (out of scope; see this checkpoint's own report).
 */

import { createPrimaryButtonNode } from "@/features/editor/factories/buttonCompositions";
import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { DEFAULT_LINK_HREF } from "@/features/editor/types/link";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BorderSettings } from "@/features/editor/types/border";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlexContainerSettings, JustifyContent } from "@/features/editor/types/flowLayout";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import { ZERO_EDGES } from "@/features/editor/types/spacing";
import type { TypographySettings } from "@/features/editor/types/typography";

/** Shared by every plain nav Link below — readable dark neutral text, overriding LinkElement's own default blue (see this file's own top comment on why the underline itself stays). */
const NAV_LINK_TYPOGRAPHY: TypographySettings = { color: "#3f3f46" };

function navLink(text: string, typography: TypographySettings = NAV_LINK_TYPOGRAPHY): EditorElementNode {
  return { id: generateNodeId("a"), tag: "a", text, href: DEFAULT_LINK_HREF, typography };
}

const NAVBAR_BACKGROUND: BackgroundSettings = { color: "#ffffff" };
const NAVBAR_BOTTOM_BORDER: BorderSettings = {
  bottom: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
};
const NAVBAR_SPACING: ElementSpacing = {
  margin: ZERO_EDGES,
  padding: { top: 16, right: 24, bottom: 16, left: 24 },
};

function horizontalNavFlex(justifyContent: JustifyContent): FlexContainerSettings {
  return { direction: "row", wrap: "nowrap", justifyContent, alignItems: "center", rowGap: 24, columnGap: 24 };
}

/** Shared root shape for the three Navbar presets (Basic/CTA/Centered) — a real, visible-but-neutral navbar bar (white background, a subtle bottom divider, comfortable padding), differing between presets only in `justifyContent` and their child Links/Button (Checkpoint 1.15.6.3, sections 8-9 and 16). */
function navbarRoot(justifyContent: JustifyContent, children: EditorElementNode[]): EditorElementNode {
  return {
    id: generateNodeId("nav"),
    tag: "nav",
    flowLayout: { display: "flex", flex: horizontalNavFlex(justifyContent) },
    background: NAVBAR_BACKGROUND,
    border: NAVBAR_BOTTOM_BORDER,
    spacing: NAVBAR_SPACING,
    children,
  };
}

/**
 * Nav > Link x4 (Checkpoint 1.15.6.3, Part A) — the literal flat tree the
 * checkpoint's own brief recommends (section 7). Deliberately no Brand/Logo
 * link (see section 30's own "consider" framing, resolved here): adding one
 * would need either an ungrouped 5th flex item (breaking the clean "4 nav
 * destinations" reading) or a nested links-wrapper Container purely to keep
 * a Brand link visually separate — extra nesting this simplest preset
 * doesn't need. Navbar with CTA below is where a genuinely asymmetric
 * (brand/links-left, action-right) layout actually earns its complexity.
 */
export function createBasicNavbarNode(): EditorElementNode {
  return navbarRoot("start", [navLink("Home"), navLink("About"), navLink("Services"), navLink("Contact")]);
}

/**
 * Nav > Link x3, Button (Checkpoint 1.15.6.3, Part B) — the smallest clean
 * tree (section 11 explicitly pre-approves skipping a links-wrapper
 * Container). `justifyContent: "space-between"` is ordinary, pre-existing
 * Flex capability (section 14) and needs no spacer node: it distributes
 * Home/Features/Pricing/Get Started across the row with the CTA landing at
 * the row's trailing edge, which is the useful part of this preset's own
 * distribution goal. Reuses createPrimaryButtonNode directly (section 12)
 * rather than re-authoring the same style fields a second time.
 */
export function createNavbarWithCtaNode(): EditorElementNode {
  const cta = createPrimaryButtonNode();
  cta.text = "Get Started";
  return navbarRoot("space-between", [navLink("Home"), navLink("Features"), navLink("Pricing"), cta]);
}

/**
 * Nav > Link x4 (Checkpoint 1.15.6.3, Part C) — structurally identical to
 * Basic Navbar, differing only in `justifyContent: "center"` (section 15:
 * "The distinction from Basic Navbar is starter CSS only"). Kept as its own
 * preset (section 16's own explicit judgment call) because a centered nav
 * is an instantly-recognizable, extremely common layout a beginner is
 * unlikely to discover on their own (it requires knowing to change the
 * Nav's own Flex justify-content setting) — a real creation-time
 * convenience even though the tree itself adds nothing new.
 */
export function createCenteredNavbarNode(): EditorElementNode {
  return navbarRoot("center", [navLink("Home"), navLink("About"), navLink("Services"), navLink("Contact")]);
}

const BREADCRUMB_FLEX: FlexContainerSettings = {
  direction: "row",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "center",
  rowGap: 8,
  columnGap: 8,
};

const BREADCRUMB_SEPARATOR_TYPOGRAPHY: TypographySettings = { color: "#a1a1aa" };
/** The current/final breadcrumb entry gets a visually muted color rather than the standing Link blue/dark-neutral — ordinary authored CSS on that one node (section 22's own "represent through ordinary authored CSS" precedent for Pagination's active page, applied here identically), never a stored `isCurrent`/`aria-current` state. */
const BREADCRUMB_CURRENT_TYPOGRAPHY: TypographySettings = { color: "#71717a" };

/** A real authored "/" separator — the cleanest representation current primitives support (Checkpoint 1.15.6.3, section 17-18): `li` cannot hold this content (List Item is a text-bearing LEAF — see insertionRules.ts's own doc comment on why "li" was deliberately left out of CONTAINER_TAGS — so `nav > ol > li(a)` is not representable at all), and no bare inline "span/text" primitive exists in this app's tag set (see documentNodeComponents.ts — only h1-h6/p/button/a/li are text-bearing). A Paragraph is the smallest existing text-bearing leaf that can sit as a bare child of `nav`. */
function breadcrumbSeparator(): EditorElementNode {
  return { id: generateNodeId("p"), tag: "p", text: "/", typography: BREADCRUMB_SEPARATOR_TYPOGRAPHY };
}

/**
 * Nav > Link, Text("/"), Link, Text("/"), Link (Checkpoint 1.15.6.3, Part
 * D). Accessibility limitation (section 19, documented rather than
 * worked around): a fully polished breadcrumb trail would carry
 * `aria-label="Breadcrumb"` on the `nav` and `aria-current="page"` on the
 * final entry — Layoutry has no generic arbitrary-attribute system yet, and
 * this checkpoint's brief explicitly rejects inventing breadcrumb-specific
 * ARIA fields, so this is deferred until a generic attributes/accessibility
 * architecture exists.
 */
export function createBreadcrumbsNode(): EditorElementNode {
  return {
    id: generateNodeId("nav"),
    tag: "nav",
    flowLayout: { display: "flex", flex: BREADCRUMB_FLEX },
    spacing: { margin: ZERO_EDGES, padding: { top: 8, right: 0, bottom: 8, left: 0 } },
    children: [
      navLink("Home"),
      breadcrumbSeparator(),
      navLink("Products"),
      breadcrumbSeparator(),
      navLink("Current Page", BREADCRUMB_CURRENT_TYPOGRAPHY),
    ],
  };
}

const PAGINATION_FLEX: FlexContainerSettings = {
  direction: "row",
  wrap: "nowrap",
  justifyContent: "center",
  alignItems: "center",
  rowGap: 8,
  columnGap: 8,
};

const PAGINATION_CONTROL_RADIUS: BorderRadiusSettings = {
  topLeft: { value: 6, unit: "px" },
  topRight: { value: 6, unit: "px" },
  bottomRight: { value: 6, unit: "px" },
  bottomLeft: { value: 6, unit: "px" },
};
const PAGINATION_CONTROL_SPACING: ElementSpacing = {
  margin: ZERO_EDGES,
  padding: { top: 6, right: 12, bottom: 6, left: 12 },
};
const PAGINATION_BORDER: BorderSettings = {
  top: { width: { value: 1, unit: "px" }, style: "solid", color: "#d4d4d8" },
  right: { width: { value: 1, unit: "px" }, style: "solid", color: "#d4d4d8" },
  bottom: { width: { value: 1, unit: "px" }, style: "solid", color: "#d4d4d8" },
  left: { width: { value: 1, unit: "px" }, style: "solid", color: "#d4d4d8" },
};
const PAGE_LINK_TYPOGRAPHY: TypographySettings = { color: "#3f3f46" };
const ACTIVE_PAGE_TYPOGRAPHY: TypographySettings = { color: "#ffffff" };
const ACTIVE_PAGE_BACKGROUND: BackgroundSettings = { color: "#18181b" };

/**
 * A numbered page Link (Checkpoint 1.15.6.3, section 20-22). Uses Link, not
 * Button (section 78): a real paginated resource plausibly gives each page
 * its own destination (e.g. `?page=2`), which is exactly what `href`
 * represents — a genuine navigation destination, unlike Previous/Next
 * below. The active page is represented purely through authored background/
 * typography fields on that one node — no `activePage`/`currentPage` state
 * anywhere (section 22's explicit prohibition).
 */
function pageLink(text: string, active: boolean): EditorElementNode {
  return {
    id: generateNodeId("a"),
    tag: "a",
    text,
    href: DEFAULT_LINK_HREF,
    typography: active ? ACTIVE_PAGE_TYPOGRAPHY : PAGE_LINK_TYPOGRAPHY,
    background: active ? ACTIVE_PAGE_BACKGROUND : undefined,
    borderRadius: PAGINATION_CONTROL_RADIUS,
    spacing: PAGINATION_CONTROL_SPACING,
  };
}

/**
 * Previous/Next (Checkpoint 1.15.6.3, section 78): a Button, not a Link —
 * neither has a real navigation destination of its own in this visual-only,
 * runtime-deferred scope (section 21: no current-page state, no click
 * handlers, no routing); a Button is the semantically honest choice for "an
 * action that would change what's shown," which is what Previous/Next
 * actually represent even though nothing here wires up that behavior yet.
 */
function paginationControlButton(text: string): EditorElementNode {
  return {
    id: generateNodeId("button"),
    tag: "button",
    text,
    background: { color: "transparent" },
    typography: PAGE_LINK_TYPOGRAPHY,
    border: PAGINATION_BORDER,
    borderRadius: PAGINATION_CONTROL_RADIUS,
    spacing: PAGINATION_CONTROL_SPACING,
  };
}

/** Nav > Button("Previous"), Link("1" active), Link("2"), Link("3"), Button("Next") (Checkpoint 1.15.6.3, Part E). No runtime pagination state anywhere on the document model — see pageLink's own doc comment. */
export function createPaginationNode(): EditorElementNode {
  return {
    id: generateNodeId("nav"),
    tag: "nav",
    flowLayout: { display: "flex", flex: PAGINATION_FLEX },
    spacing: { margin: ZERO_EDGES, padding: ZERO_EDGES },
    children: [
      paginationControlButton("Previous"),
      pageLink("1", true),
      pageLink("2", false),
      pageLink("3", false),
      paginationControlButton("Next"),
    ],
  };
}

const SIDEBAR_FLEX: FlexContainerSettings = {
  direction: "column",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 4,
  columnGap: 4,
};
const SIDEBAR_SPACING: ElementSpacing = {
  margin: ZERO_EDGES,
  padding: { top: 16, right: 16, bottom: 16, left: 16 },
};
const SIDEBAR_LINK_SPACING: ElementSpacing = {
  margin: ZERO_EDGES,
  padding: { top: 8, right: 12, bottom: 8, left: 12 },
};
const SIDEBAR_LINK_RADIUS: BorderRadiusSettings = {
  topLeft: { value: 6, unit: "px" },
  topRight: { value: 6, unit: "px" },
  bottomRight: { value: 6, unit: "px" },
  bottomLeft: { value: 6, unit: "px" },
};

function sidebarLink(text: string): EditorElementNode {
  return {
    id: generateNodeId("a"),
    tag: "a",
    text,
    href: DEFAULT_LINK_HREF,
    typography: NAV_LINK_TYPOGRAPHY,
    spacing: SIDEBAR_LINK_SPACING,
    borderRadius: SIDEBAR_LINK_RADIUS,
  };
}

/**
 * Nav > Link x4, Flex Column (Checkpoint 1.15.6.3, Part F). Deliberately
 * scoped to vertical navigation only (section 25's own explicit boundary) —
 * no Logo/Profile/Account/Footer children; a full Sidebar shell is left as
 * a possible future, separate Components family. No explicit width is
 * stamped (section 26: "must remain easy to resize"; `dimensions` is this
 * app's own "user's own resize intent" field — see ElementDimensions's own
 * doc comment — stamping it in a factory would fake a manual resize that
 * never happened, which no other composition in this codebase does either).
 */
export function createSidebarNavigationNode(): EditorElementNode {
  return {
    id: generateNodeId("nav"),
    tag: "nav",
    flowLayout: { display: "flex", flex: SIDEBAR_FLEX },
    spacing: SIDEBAR_SPACING,
    children: [sidebarLink("Dashboard"), sidebarLink("Projects"), sidebarLink("Settings"), sidebarLink("Help")],
  };
}
