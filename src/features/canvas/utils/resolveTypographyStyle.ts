import { formatCssLength, getTypographySettings } from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * CSS for a text-bearing node's own typography (Checkpoint 4.2) — only
 * ever emits a property for a field the node has *explicitly* set; every
 * other field is simply absent from the returned object, so the element's
 * own Tailwind classes (its tag-specific default presentation — see
 * HeadingElement/ParagraphElement/ButtonElement) keep governing anything
 * left unset. This is why getTypographySettings deliberately doesn't
 * synthesize defaults the way getMediaFitSettings does: there is no
 * single "default font size" across every tag for this resolver to fall
 * back to, and there doesn't need to be one — inline style only overrides
 * what's genuinely explicit.
 */
export function resolveTypographyStyle(node: EditorElementNode): CSSProperties {
  const typography = getTypographySettings(node);
  const style: CSSProperties = {};

  if (typography.fontFamily) style.fontFamily = typography.fontFamily;
  if (typography.fontSize) style.fontSize = formatCssLength(typography.fontSize);
  if (typography.fontWeight) style.fontWeight = typography.fontWeight;
  if (typography.fontStyle) style.fontStyle = typography.fontStyle;
  if (typography.color) style.color = typography.color;
  if (typography.textAlign) style.textAlign = typography.textAlign;
  if (typography.lineHeight) style.lineHeight = formatCssLength(typography.lineHeight);
  if (typography.letterSpacing) style.letterSpacing = formatCssLength(typography.letterSpacing);

  return style;
}
