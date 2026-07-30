import {
  BACKGROUND_POSITION_CSS,
  formatBackgroundSizeAxis,
  getActiveBackgroundSource,
  getBackgroundSettings,
} from "@/features/editor/types/background";
import { formatGradientCss } from "@/features/editor/types/gradient";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

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
 * Pure Canvas resolver for a node's own background (Checkpoint 4.3,
 * extended for Gradient in 4.3.1) — same shape as resolveTypographyStyle:
 * emits CSS only for the fields actually present/active, never a guessed
 * default. Background Color is always independent of source (Checkpoint
 * 4.3.1's #1). Only ONE of Image/Gradient ever renders — see
 * getActiveBackgroundSource, which also carries the Checkpoint-4.3-
 * document backward-compatibility fallback. `size`/`position`/`repeat`/
 * `attachment` are Image-only (Checkpoint 4.3.1's #13 — a previously
 * configured Image's settings must never leak into a Gradient's
 * rendering, e.g. a stale `background-repeat: repeat` from before the
 * user switched sources), even though the model itself keeps them
 * stored (and thus ready to reapply) while Gradient is active.
 */
export function resolveBackgroundStyle(node: EditorElementNode): CSSProperties {
  const background = getBackgroundSettings(node);
  const style: CSSProperties = {};
  const activeSource = getActiveBackgroundSource(background);

  if (background.color) style.backgroundColor = background.color;

  if (activeSource === "image" && background.image) {
    style.backgroundImage = cssUrl(background.image);

    if (background.size === "custom" && background.customSize) {
      style.backgroundSize = `${formatBackgroundSizeAxis(background.customSize.width)} ${formatBackgroundSizeAxis(background.customSize.height)}`;
    } else if (background.size && background.size !== "custom") {
      style.backgroundSize = background.size;
    }

    if (background.position) style.backgroundPosition = BACKGROUND_POSITION_CSS[background.position];
    if (background.repeat) style.backgroundRepeat = background.repeat;
    if (background.attachment) style.backgroundAttachment = background.attachment;
  } else if (activeSource === "gradient" && background.gradient) {
    const gradientCss = formatGradientCss(background.gradient);
    if (gradientCss) style.backgroundImage = gradientCss;
  }

  return style;
}
