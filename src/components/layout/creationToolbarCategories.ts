export interface CategoryPlaceholderRow {
  id: string;
  label: string;
  disabled: true;
}

export interface CategorySection {
  id: string;
  label: string;
  rows: CategoryPlaceholderRow[];
}

export interface ToolbarCategoryContent {
  id: string;
  label: string;
  sections: CategorySection[];
}

function tbdSection(
  categoryId: string,
  sectionId: string,
  label: string,
): CategorySection {
  return {
    id: `${categoryId}-${sectionId}`,
    label,
    rows: [
      { id: `${categoryId}-${sectionId}-tbd`, label: "(TBD)", disabled: true },
    ],
  };
}

function htmlCategory(): ToolbarCategoryContent {
  const id = "html";
  return {
    id,
    label: "HTML",
    sections: [
      tbdSection(id, "containers", "Containers"),
      tbdSection(id, "typography", "Typography"),
      tbdSection(id, "navigation", "Navigation"),
      tbdSection(id, "lists", "Lists"),
      tbdSection(id, "forms", "Forms"),
      tbdSection(id, "media", "Media"),
      tbdSection(id, "tables", "Tables"),
      tbdSection(id, "semantic", "Semantic Elements"),
    ],
  };
}

function componentsCategory(): ToolbarCategoryContent {
  const id = "components";
  return {
    id,
    label: "Components",
    sections: [
      tbdSection(id, "buttons-actions", "Buttons & Actions"),
      tbdSection(id, "cards-containers", "Cards & Containers"),
      tbdSection(id, "navigation", "Navigation"),
      tbdSection(id, "forms-inputs", "Forms & Inputs"),
      tbdSection(id, "feedback-overlays", "Feedback & Overlays"),
      tbdSection(id, "data-display", "Data Display"),
    ],
  };
}

function layoutCategory(): ToolbarCategoryContent {
  const id = "layout";
  return {
    id,
    label: "Layout",
    sections: [
      tbdSection(id, "flex", "Flex Layouts"),
      tbdSection(id, "grid", "Grid Layouts"),
      tbdSection(id, "containers-wrappers", "Containers & Wrappers"),
      tbdSection(id, "spacers-dividers", "Spacers & Dividers"),
      tbdSection(id, "responsive-presets", "Responsive Presets"),
    ],
  };
}

function mediaCategory(): ToolbarCategoryContent {
  const id = "media";
  return {
    id,
    label: "Media",
    sections: [
      tbdSection(id, "images", "Images"),
      tbdSection(id, "video", "Video"),
      tbdSection(id, "audio", "Audio"),
      tbdSection(id, "icons", "Icons"),
      tbdSection(id, "embeds", "Embeds"),
    ],
  };
}

function formsCategory(): ToolbarCategoryContent {
  const id = "forms";
  return {
    id,
    label: "Forms",
    sections: [
      tbdSection(id, "inputs", "Inputs"),
      tbdSection(id, "selection-controls", "Selection Controls"),
      tbdSection(id, "buttons", "Buttons"),
      tbdSection(id, "validation-feedback", "Validation & Feedback"),
      tbdSection(id, "layout-grouping", "Layout & Grouping"),
    ],
  };
}

function stylesCategory(): ToolbarCategoryContent {
  const id = "styles";
  return {
    id,
    label: "Styles",
    sections: [
      tbdSection(id, "typography", "Typography"),
      tbdSection(id, "color-theme", "Color & Theme"),
      tbdSection(id, "spacing", "Spacing"),
      tbdSection(id, "effects", "Effects"),
      tbdSection(id, "global-styles", "Global Styles"),
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
