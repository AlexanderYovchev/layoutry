import {
  Code2,
  Component,
  Image,
  LayoutGrid,
  Palette,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";

/** Literal Tailwind class strings for one category's accent treatment (see categoryAppearance below). */
export interface ToolbarCategoryAccent {
  /** Icon color. */
  icon: string;
  /** Resting tint plus hover treatment. */
  rest: string;
  /** Open/expanded state: a stronger tint and a category-colored border. */
  open: string;
  /** Tinted icon tile used by the toolbar dropdown's row cards. */
  iconBox: string;
}

export interface CategoryAppearance {
  icon: LucideIcon;
  accent: ToolbarCategoryAccent;
}

// Full literal class strings per category (never assembled from the id
// at runtime) so Tailwind's source scanner sees every one of them.
// Colors come from the --ly-category-* tokens in globals.css.
export const categoryAppearance: Record<string, CategoryAppearance> = {
  html: {
    icon: Code2,
    accent: {
      icon: "text-category-html",
      rest: "bg-category-html-bg/55 hover:border-category-html/30 hover:bg-category-html-bg",
      open: "border-category-html/55 bg-category-html-bg",
      iconBox: "border-category-html/20 bg-category-html-bg text-category-html",
    },
  },
  components: {
    icon: Component,
    accent: {
      icon: "text-category-components",
      rest: "bg-category-components-bg/55 hover:border-category-components/30 hover:bg-category-components-bg",
      open: "border-category-components/55 bg-category-components-bg",
      iconBox:
        "border-category-components/20 bg-category-components-bg text-category-components",
    },
  },
  layout: {
    icon: LayoutGrid,
    accent: {
      icon: "text-category-layout",
      rest: "bg-category-layout-bg/55 hover:border-category-layout/30 hover:bg-category-layout-bg",
      open: "border-category-layout/55 bg-category-layout-bg",
      iconBox:
        "border-category-layout/20 bg-category-layout-bg text-category-layout",
    },
  },
  media: {
    icon: Image,
    accent: {
      icon: "text-category-media",
      rest: "bg-category-media-bg/55 hover:border-category-media/30 hover:bg-category-media-bg",
      open: "border-category-media/55 bg-category-media-bg",
      iconBox:
        "border-category-media/20 bg-category-media-bg text-category-media",
    },
  },
  forms: {
    icon: TextCursorInput,
    accent: {
      icon: "text-category-forms",
      rest: "bg-category-forms-bg/55 hover:border-category-forms/30 hover:bg-category-forms-bg",
      open: "border-category-forms/55 bg-category-forms-bg",
      iconBox:
        "border-category-forms/20 bg-category-forms-bg text-category-forms",
    },
  },
  styles: {
    icon: Palette,
    accent: {
      icon: "text-category-styles",
      rest: "bg-category-styles-bg/55 hover:border-category-styles/30 hover:bg-category-styles-bg",
      open: "border-category-styles/55 bg-category-styles-bg",
      iconBox:
        "border-category-styles/20 bg-category-styles-bg text-category-styles",
    },
  },
};
