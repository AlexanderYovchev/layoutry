import {
  formatBackgroundSizeAxis,
  getBackgroundSettings,
  type BackgroundPosition,
} from "@/features/editor/types/background";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

const BACKGROUND_POSITION_CSS: Record<BackgroundPosition, string> = {
  "top-left": "left top",
  "top-center": "center top",
  "top-right": "right top",
  "center-left": "left center",
  center: "center",
  "center-right": "right center",
  "bottom-left": "left bottom",
  "bottom-center": "center bottom",
  "bottom-right": "right bottom",
};

/**
 * Wraps a background-image URL as a CSS `url(...)` value. Uses
 * JSON.stringify for the quoting/escaping rather than hand-rolled string
 * concatenation — isValidBackgroundImageUrl already rejects any quote,
 * backslash, or whitespace character before a value reaches here, but
 * this is the actual point where user-provided text becomes CSS text, so
 * it escapes defensively regardless of what already validated it.
 */
function cssUrl(value: string): string {
  return `url(${JSON.stringify(value)})`;
}

/**
 * Pure Canvas resolver for a node's own background (Checkpoint 4.3) —
 * same shape as resolveTypographyStyle: emits CSS only for the fields
 * actually present in BackgroundSettings, never a guessed default for an
 * unset field. `size`/`position`/`repeat`/`attachment` are resolved
 * independently of whether `image` is set — the model allows them
 * independently (see BackgroundSettings), even though the Inspector only
 * exposes them once an image exists (see InspectorBackgroundSection).
 */
export function resolveBackgroundStyle(node: EditorElementNode): CSSProperties {
  const background = getBackgroundSettings(node);
  const style: CSSProperties = {};

  if (background.color) style.backgroundColor = background.color;
  if (background.image) style.backgroundImage = cssUrl(background.image);

  if (background.size === "custom" && background.customSize) {
    style.backgroundSize = `${formatBackgroundSizeAxis(background.customSize.width)} ${formatBackgroundSizeAxis(background.customSize.height)}`;
  } else if (background.size && background.size !== "custom") {
    style.backgroundSize = background.size;
  }

  if (background.position) style.backgroundPosition = BACKGROUND_POSITION_CSS[background.position];
  if (background.repeat) style.backgroundRepeat = background.repeat;
  if (background.attachment) style.backgroundAttachment = background.attachment;

  return style;
}
