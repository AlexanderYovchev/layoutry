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
  | "image";

export interface CatalogCardPlaceholder {
  id: string;
  name: string;
  description: string;
  /** True whenever elementType is unset — a card is only ever enabled because a real factory exists for it. */
  disabled: boolean;
  elementType?: InsertableCardType;
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
        },
        {
          name: "Section",
          description: "Generic content section",
          elementType: "section",
        },
      ]),
      section(id, "typography", "Typography", [
        { name: "Heading", description: "Page heading", elementType: "heading" },
        {
          name: "Paragraph",
          description: "Body text",
          elementType: "paragraph",
        },
      ]),
      section(id, "navigation", "Navigation", [
        { name: "Link", description: "Navigable link" },
        { name: "Menu", description: "Navigation menu" },
      ]),
      section(id, "lists", "Lists", [
        { name: "List", description: "Ordered or unordered list" },
        { name: "List Item", description: "Single list entry" },
      ]),
      section(id, "forms", "Forms", [
        { name: "Input", description: "Single-line text field" },
        {
          name: "Button",
          description: "Interactive button",
          elementType: "button",
        },
      ]),
      section(id, "media", "Media", [
        { name: "Image", description: "Static image", elementType: "image" },
        { name: "Video", description: "Embedded video" },
      ]),
      section(id, "tables", "Tables", [
        { name: "Table", description: "Tabular data grid" },
        { name: "Table Row", description: "Single table row" },
      ]),
      section(id, "semantic", "Semantic Elements", [
        { name: "Article", description: "Self-contained content" },
        { name: "Header", description: "Page or section header" },
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
      section(id, "buttons-actions", "Buttons & Actions", [
        { name: "Primary Button", description: "Main call-to-action button" },
        { name: "Icon Button", description: "Compact icon-only action" },
      ]),
      section(id, "cards-containers", "Cards & Containers", [
        { name: "Card", description: "Content container with elevation" },
        { name: "Panel", description: "Grouped content area" },
      ]),
      section(id, "navigation", "Navigation", [
        { name: "Tabs", description: "Switch between views" },
        { name: "Breadcrumb", description: "Hierarchical location trail" },
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
        { name: "Image", description: "Static image placeholder" },
        { name: "Gallery", description: "Grid of images" },
      ]),
      section(id, "video", "Video", [
        { name: "Video Player", description: "Embedded video player" },
        { name: "Video Background", description: "Looping background video" },
      ]),
      section(id, "audio", "Audio", [
        { name: "Audio Player", description: "Embedded audio player" },
      ]),
      section(id, "icons", "Icons", [
        { name: "Icon", description: "Single vector icon" },
      ]),
      section(id, "embeds", "Embeds", [
        { name: "Embed", description: "Third-party embedded content" },
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
      section(id, "inputs", "Inputs", [
        { name: "Text Input", description: "Single-line text field" },
        { name: "Textarea", description: "Multi-line text field" },
      ]),
      section(id, "selection-controls", "Selection Controls", [
        { name: "Checkbox", description: "Toggleable option" },
        { name: "Radio Button", description: "Single choice option" },
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
