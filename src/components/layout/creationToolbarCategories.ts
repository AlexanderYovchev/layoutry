import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  AlignLeft,
  AppWindow,
  AtSign,
  Blocks,
  Box,
  ChevronDown,
  ChevronsDown,
  ChevronsLeftRight,
  ChevronsRight,
  Circle,
  CircleDot,
  CircleUserRound,
  ClipboardList,
  Columns2,
  Columns3,
  Globe,
  Hash,
  Image,
  Layout,
  LayoutPanelTop,
  LayoutTemplate,
  Link,
  List,
  ListOrdered,
  Lock,
  Menu,
  MousePointerClick,
  Newspaper,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Phone,
  Pointer,
  Receipt,
  RectangleHorizontal,
  Search,
  Sparkles,
  Spline,
  Square,
  SquareCheck,
  SquareDashed,
  Table,
  Video,
  Tag,
  TextCursorInput,
  TextQuote,
  Type,
} from "lucide-react";

/**
 * Mirrors the editor feature's InsertableElementType string-for-string,
 * without importing it — components/layout must not import src/features/*,
 * so this file owns its own minimal vocabulary and the composition root
 * (EditorApp) validates/maps the string at the boundary where it actually
 * calls into the editor.
 */
export type InsertableCardType =
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
  | "pricingCard";

export interface CatalogCardPlaceholder {
  id: string;
  name: string;
  description: string;
  /** True whenever elementType is unset — a card is only ever enabled because a real factory exists for it. */
  disabled: boolean;
  elementType?: InsertableCardType;
  /** A recognizable per-card icon (Checkpoint 1.12.1) — undefined for every still-disabled placeholder card, which keeps CatalogCard's existing dashed-square fallback. */
  icon?: LucideIcon;
}

export interface CategorySection {
  id: string;
  label: string;
  cards: CatalogCardPlaceholder[];
}

export interface ToolbarCategoryContent {
  id: string;
  label: string;
  sections: CategorySection[];
}

interface CardSeed {
  name: string;
  description: string;
  elementType?: InsertableCardType;
  icon?: LucideIcon;
}

function section(
  categoryId: string,
  sectionId: string,
  label: string,
  cardSeeds: CardSeed[],
): CategorySection {
  return {
    id: `${categoryId}-${sectionId}`,
    label,
    cards: cardSeeds.map((seed, index) => ({
      id: `${categoryId}-${sectionId}-${index}`,
      name: seed.name,
      description: seed.description,
      disabled: !seed.elementType,
      elementType: seed.elementType,
      icon: seed.icon,
    })),
  };
}

function htmlCategory(): ToolbarCategoryContent {
  const id = "html";
  return {
    id,
    label: "HTML",
    sections: [
      section(id, "containers", "Containers", [
        {
          name: "Container",
          description: "Generic layout container",
          elementType: "container",
          icon: Box,
        },
        {
          name: "Section",
          description: "Generic content section",
          elementType: "section",
          icon: Layout,
        },
      ]),
      section(id, "typography", "Typography", [
        { name: "Heading", description: "Page heading", elementType: "heading", icon: Type },
        {
          name: "Paragraph",
          description: "Body text",
          elementType: "paragraph",
          icon: AlignLeft,
        },
      ]),
      section(id, "navigation", "Navigation", [
        { name: "Link", description: "Navigable link", elementType: "link", icon: Link },
        { name: "Menu", description: "Navigation menu" },
      ]),
      section(id, "lists", "Lists", [
        {
          name: "Unordered List",
          description: "Bulleted list",
          elementType: "unorderedList",
          icon: List,
        },
        {
          name: "Ordered List",
          description: "Numbered list",
          elementType: "orderedList",
          icon: ListOrdered,
        },
        {
          name: "List Item",
          description: "Single list entry",
          elementType: "listItem",
          icon: Circle,
        },
      ]),
      section(id, "interactive", "Interactive", [
        {
          name: "Button",
          description: "Interactive button",
          elementType: "button",
          icon: MousePointerClick,
        },
      ]),
      section(id, "tables", "Tables", [
        {
          name: "Table",
          description: "Tabular data grid with starter rows and columns",
          elementType: "table",
          icon: Table,
        },
      ]),
      section(id, "semantic", "Semantic Elements", [
        {
          name: "Header",
          description: "Page or section header",
          elementType: "header",
          icon: PanelTop,
        },
        {
          name: "Nav",
          description: "Navigation links",
          elementType: "nav",
          icon: Menu,
        },
        {
          name: "Main",
          description: "Primary page content",
          elementType: "main",
          icon: LayoutPanelTop,
        },
        {
          name: "Article",
          description: "Self-contained content",
          elementType: "article",
          icon: Newspaper,
        },
        {
          name: "Aside",
          description: "Related or tangential content",
          elementType: "aside",
          icon: PanelRight,
        },
        {
          name: "Footer",
          description: "Page or section footer",
          elementType: "footer",
          icon: PanelBottom,
        },
        {
          name: "Simple Footer",
          description: "Footer starter with copyright text and links",
          elementType: "footerComposition",
          icon: Blocks,
        },
      ]),
    ],
  };
}

function componentsCategory(): ToolbarCategoryContent {
  const id = "components";
  return {
    id,
    label: "Components",
    sections: [
      section(id, "buttons", "Buttons", [
        { name: "Primary Button", description: "Solid, high-emphasis call-to-action button", elementType: "primaryButton", icon: Square },
        { name: "Secondary Button", description: "Lighter, medium-emphasis button", elementType: "secondaryButton", icon: RectangleHorizontal },
        { name: "Outline Button", description: "Transparent fill with a visible border", elementType: "outlineButton", icon: SquareDashed },
        { name: "Ghost Button", description: "Minimal button with no fill or border", elementType: "ghostButton", icon: Pointer },
        { name: "Button Group", description: "Row of buttons sharing one Flex container", elementType: "buttonGroup", icon: Columns3 },
        { name: "Dropdown Button", description: "Button with an attached menu of links, open on Canvas", elementType: "dropdownButton", icon: ChevronsDown },
      ]),
      section(id, "cards-containers", "Cards & Containers", [
        { name: "Basic Card", description: "Heading, description, and a Learn More link", elementType: "basicCard", icon: LayoutTemplate },
        { name: "Image Card", description: "Media above a heading, description, and link", elementType: "imageCard", icon: Image },
        { name: "Horizontal Card", description: "Media beside a heading, description, and link", elementType: "horizontalCard", icon: Columns2 },
        { name: "Profile Card", description: "Circular avatar with a name, role, and link", elementType: "profileCard", icon: CircleUserRound },
        { name: "Feature Card", description: "Heading and description for a landing-page feature", elementType: "featureCard", icon: Sparkles },
        { name: "Pricing Card", description: "Plan name, price, feature list, and a Choose Plan button", elementType: "pricingCard", icon: Receipt },
        { name: "Panel", description: "Grouped content area" },
      ]),
      section(id, "navigation", "Navigation", [
        { name: "Basic Navbar", description: "Nav bar with four starter links", elementType: "basicNavbar", icon: Menu },
        { name: "Navbar with CTA", description: "Nav links distributed against a call-to-action button", elementType: "navbarWithCta", icon: PanelTop },
        { name: "Centered Navbar", description: "Nav links centered in the bar", elementType: "centeredNavbar", icon: AlignCenter },
        { name: "Breadcrumbs", description: "Hierarchical location trail with separators", elementType: "breadcrumbs", icon: ChevronsRight },
        { name: "Pagination", description: "Previous/Next controls with numbered page links", elementType: "pagination", icon: ChevronsLeftRight },
        { name: "Sidebar Navigation", description: "Vertical column of navigation links", elementType: "sidebarNavigation", icon: PanelLeft },
      ]),
      section(id, "forms-inputs", "Forms & Inputs", [
        { name: "Text Field", description: "Labeled input with validation" },
        { name: "Select", description: "Dropdown choice control" },
      ]),
      section(id, "feedback-overlays", "Feedback & Overlays", [
        { name: "Modal", description: "Overlay dialog" },
        { name: "Toast", description: "Temporary status message" },
      ]),
      section(id, "data-display", "Data Display", [
        { name: "Badge", description: "Small status indicator" },
        { name: "Avatar", description: "User profile image" },
      ]),
    ],
  };
}

function layoutCategory(): ToolbarCategoryContent {
  const id = "layout";
  return {
    id,
    label: "Layout",
    sections: [
      section(id, "flex", "Flex Layouts", [
        { name: "Row", description: "Horizontal flex container" },
        { name: "Column", description: "Vertical flex container" },
      ]),
      section(id, "grid", "Grid Layouts", [
        { name: "Grid", description: "CSS grid container" },
        { name: "Grid Item", description: "Single grid cell" },
      ]),
      section(id, "containers-wrappers", "Containers & Wrappers", [
        { name: "Wrapper", description: "Generic content wrapper" },
        { name: "Section Frame", description: "Bordered content frame" },
      ]),
      section(id, "spacers-dividers", "Spacers & Dividers", [
        { name: "Spacer", description: "Empty flexible space" },
        { name: "Divider", description: "Horizontal separator line" },
      ]),
      section(id, "responsive-presets", "Responsive Presets", [
        { name: "Two Column", description: "Responsive two-column layout" },
        { name: "Stack", description: "Responsive vertical stack" },
      ]),
    ],
  };
}

function mediaCategory(): ToolbarCategoryContent {
  const id = "media";
  return {
    id,
    label: "Media",
    sections: [
      section(id, "images", "Images", [
        { name: "Image", description: "Static image", elementType: "image", icon: Image },
        { name: "Gallery", description: "Grid of images" },
      ]),
      section(id, "video", "Video", [
        {
          name: "Video",
          description: "Video files or URLs, with playback controls",
          elementType: "video",
          icon: Video,
        },
        { name: "Video Background", description: "Looping background video" },
      ]),
      section(id, "audio", "Audio", [
        { name: "Audio Player", description: "Embedded audio player" },
      ]),
      section(id, "vector", "Vector Graphics", [
        {
          name: "SVG",
          description: "Scalable vector graphic",
          elementType: "svg",
          icon: Spline,
        },
      ]),
      section(id, "icons", "Icons", [
        { name: "Icon", description: "Single vector icon" },
      ]),
      section(id, "embeds", "Embeds", [
        {
          name: "Embed",
          description: "External embeddable pages or content",
          elementType: "iframe",
          icon: AppWindow,
        },
      ]),
    ],
  };
}

function formsCategory(): ToolbarCategoryContent {
  const id = "forms";
  return {
    id,
    label: "Forms",
    sections: [
      section(id, "structure", "Structure", [
        {
          name: "Form",
          description: "Form container",
          elementType: "form",
          icon: ClipboardList,
        },
        {
          name: "Label",
          description: "Wraps and labels a control",
          elementType: "label",
          icon: Tag,
        },
      ]),
      section(id, "inputs", "Inputs", [
        {
          name: "Text Input",
          description: "Single-line text field",
          elementType: "input",
          icon: TextCursorInput,
        },
        {
          name: "Email Input",
          description: "Email address field",
          elementType: "emailInput",
          icon: AtSign,
        },
        {
          name: "Password Input",
          description: "Masked password field",
          elementType: "passwordInput",
          icon: Lock,
        },
        {
          name: "Number Input",
          description: "Numeric field",
          elementType: "numberInput",
          icon: Hash,
        },
        {
          name: "Search Input",
          description: "Search query field",
          elementType: "searchInput",
          icon: Search,
        },
        {
          name: "URL Input",
          description: "Web address field",
          elementType: "urlInput",
          icon: Globe,
        },
        {
          name: "Tel Input",
          description: "Phone number field",
          elementType: "telInput",
          icon: Phone,
        },
        {
          name: "Textarea",
          description: "Multi-line text field",
          elementType: "textarea",
          icon: TextQuote,
        },
        {
          name: "Select",
          description: "Dropdown choice field with starter options",
          elementType: "select",
          icon: ChevronDown,
        },
      ]),
      section(id, "selection-controls", "Selection Controls", [
        {
          name: "Checkbox",
          description: "Toggleable option",
          elementType: "checkboxInput",
          icon: SquareCheck,
        },
        {
          name: "Radio Button",
          description: "Single choice option",
          elementType: "radioInput",
          icon: CircleDot,
        },
      ]),
      section(id, "buttons", "Buttons", [
        { name: "Submit Button", description: "Submits the form" },
        { name: "Reset Button", description: "Clears the form" },
      ]),
      section(id, "validation-feedback", "Validation & Feedback", [
        { name: "Error Message", description: "Inline validation message" },
        { name: "Helper Text", description: "Supplementary field guidance" },
      ]),
      section(id, "layout-grouping", "Layout & Grouping", [
        { name: "Fieldset", description: "Grouped form fields" },
        { name: "Form Row", description: "Horizontal field grouping" },
      ]),
    ],
  };
}

function stylesCategory(): ToolbarCategoryContent {
  const id = "styles";
  return {
    id,
    label: "Styles",
    sections: [
      section(id, "typography", "Typography", [
        { name: "Font Scale", description: "Type size presets" },
        { name: "Font Weight", description: "Weight presets" },
      ]),
      section(id, "color-theme", "Color & Theme", [
        { name: "Color Palette", description: "Brand color tokens" },
        { name: "Theme Toggle", description: "Light/dark mode control" },
      ]),
      section(id, "spacing", "Spacing", [
        { name: "Spacing Scale", description: "Consistent spacing tokens" },
        { name: "Padding Preset", description: "Common padding values" },
      ]),
      section(id, "effects", "Effects", [
        { name: "Shadow", description: "Elevation shadow presets" },
        { name: "Border Radius", description: "Corner rounding presets" },
      ]),
      section(id, "global-styles", "Global Styles", [
        { name: "Reset", description: "Base style reset" },
        { name: "Typography Base", description: "Base font settings" },
      ]),
    ],
  };
}

export const creationToolbarCategories: ToolbarCategoryContent[] = [
  htmlCategory(),
  componentsCategory(),
  layoutCategory(),
  mediaCategory(),
  formsCategory(),
  stylesCategory(),
];
