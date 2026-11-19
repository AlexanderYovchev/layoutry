import type { AspectRatioValue } from "@/features/editor/types/aspectRatio";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderSettings } from "@/features/editor/types/border";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BoxShadowSettings } from "@/features/editor/types/boxShadow";
import type { DisplaySettings } from "@/features/editor/types/display";
import type { FilterSettings } from "@/features/editor/types/filters";
import type { FlexChildSettings, FlowLayoutSettings, GridChildSettings } from "@/features/editor/types/flowLayout";
import type { ChildResizePolicy } from "@/features/editor/types/layout";
import type { MediaFitSettings } from "@/features/editor/types/mediaFit";
import type { PositionSettings } from "@/features/editor/types/position";
import type { ShapePreset } from "@/features/editor/types/shape";
import type { SizeConstraints } from "@/features/editor/types/sizeConstraints";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import type { TransformSettings } from "@/features/editor/types/transform";
import type { TransitionSettings } from "@/features/editor/types/transition";
import type { TypographySettings } from "@/features/editor/types/typography";

/**
 * BC-11.2 — Copy/Paste CSS. A snapshot of one element's AUTHORED CSS
 * settings (never computed values), keyed by CSS group. A group is present
 * only when the source authored something in it; inside a group, only the
 * fields the source authored are present. Values are the document model's
 * own typed settings (units, lists, gradients and layout kept as typed),
 * deep-cloned at copy time, so later edits to the source never change it.
 */
export interface StyleSnapshot {
  typography?: TypographySettings;
  background?: BackgroundSettings;
  border?: BorderSettings;
  borderRadius?: BorderRadiusSettings;
  shape?: ShapePreset;
  boxShadow?: BoxShadowSettings;
  filters?: FilterSettings;
  transition?: TransitionSettings;
  transform?: TransformSettings;
  display?: DisplaySettings;
  position?: PositionSettings;
  spacing?: ElementSpacing;
  /** Width/height (as the source authored them: its Flow size, or its Free box's size), min/max and aspect ratio. */
  size?: { box?: { width: number; height: number }; constraints?: SizeConstraints; aspectRatio?: AspectRatioValue };
  mediaFit?: MediaFitSettings;
  /** SVG fill/stroke presentation (not its primitive, viewBox or drawn content). */
  svgPaint?: { fill?: string; stroke?: string; strokeWidth?: number };
  /** The source container's own content layout: Flow (block/Flex/Grid and their settings) or Free (child resize policy). */
  layout?: { mode: "flow"; flowLayout: FlowLayoutSettings } | { mode: "free"; childResizePolicy?: ChildResizePolicy };
  flexChild?: FlexChildSettings;
  gridChild?: GridChildSettings;
}

export type StyleGroupKey = keyof StyleSnapshot;

/**
 * The editor-only CSS clipboard (BC-11.2): separate from the element
 * clipboard, session-only, never saved and never in Undo history.
 */
export interface StyleClipboard {
  version: 1;
  /** The source's readable name at copy time, for feedback only (never a live reference). */
  sourceName: string;
  groups: StyleSnapshot;
}
