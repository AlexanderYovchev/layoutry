import type { CSSProperties } from "react";
import type {
  ElementStyleContext,
  ElementStyleRecipe,
} from "@/features/canvas/types/elementStyleRecipe";
import {
  resolveAudioElementStyle,
  resolveBoxElementStyle,
  resolveContainerElementStyle,
  resolveControlElementStyle,
  resolveDialogElementStyle,
  resolveImageElementStyle,
  resolveLegacyBodyElementStyle,
  resolveOptionElementStyle,
  resolvePageRootElementStyle,
  resolveSvgElementStyle,
  resolveTableCellElementStyle,
  resolveTableStructureElementStyle,
  resolveTextElementStyle,
  resolveVideoOrIframeElementStyle,
} from "@/features/canvas/utils/elementStyleRecipes";
import type { EditorElementNode } from "@/features/editor/types/document";

/*
 * BC-17.3 — the ONE tag → style recipe dispatch, used by the shared
 * compiler for every surface and by the export's element builder. Before
 * this, each Canvas element component and the export builder picked the
 * recipe themselves (the same functions, chosen twice). The recipes are
 * unchanged (elementStyleRecipes.ts).
 */

export interface NodeStyleRecipe extends ElementStyleRecipe {
  /** The genuine inner media element's own style (image, video, audio, embed). */
  innerStyle?: CSSProperties;
}

const CONTAINER_TAGS: ReadonlySet<string> = new Set([
  "div",
  "section",
  "ul",
  "ol",
  "header",
  "nav",
  "main",
  "article",
  "aside",
  "footer",
  "form",
  "label",
  "fieldset",
  "figure",
]);
const TEXT_TAGS: ReadonlySet<string> = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "legend",
  "figcaption",
  "a",
  "button",
]);
const CONTROL_TAGS: ReadonlySet<string> = new Set([
  "input",
  "textarea",
  "select",
  "table",
]);
const TABLE_STRUCTURE_TAGS: ReadonlySet<string> = new Set([
  "thead",
  "tbody",
  "tfoot",
  "tr",
]);

const EMPTY: NodeStyleRecipe = { defaults: [], style: {} };

/** The recipe for a node in its context; an unknown tag (the Canvas's FallbackElement) has no authored CSS. */
export function resolveNodeStyleRecipe(
  node: EditorElementNode,
  context: ElementStyleContext,
): NodeStyleRecipe {
  const { tag } = node;
  if (tag === "page") return resolvePageRootElementStyle();
  if (tag === "body") return resolveLegacyBodyElementStyle();
  if (CONTAINER_TAGS.has(tag))
    return resolveContainerElementStyle(node, context);
  if (TEXT_TAGS.has(tag)) return resolveTextElementStyle(node, context);
  if (CONTROL_TAGS.has(tag)) return resolveControlElementStyle(node, context);
  if (tag === "option") return resolveOptionElementStyle(node);
  if (TABLE_STRUCTURE_TAGS.has(tag))
    return resolveTableStructureElementStyle(node);
  // Table cells and captions never take a Flex/Grid child role.
  if (tag === "th" || tag === "td" || tag === "caption")
    return resolveTableCellElementStyle(node, {
      ...context,
      parentFlowDisplay: "block",
    });
  if (tag === "hr" || tag === "progress")
    return resolveBoxElementStyle(node, context);
  if (tag === "img") return resolveImageElementStyle(node, context);
  if (tag === "video" || tag === "iframe")
    return resolveVideoOrIframeElementStyle(node, context);
  if (tag === "audio") return resolveAudioElementStyle(node, context);
  if (tag === "svg") return resolveSvgElementStyle(node, context);
  if (tag === "dialog") return resolveDialogElementStyle(node, context);
  return EMPTY;
}

/** Whether the node renders a genuine inner element with its own rule (the media frames). */
export function hasInnerMediaElement(
  node: Pick<EditorElementNode, "tag">,
): boolean {
  return (
    node.tag === "img" ||
    node.tag === "video" ||
    node.tag === "audio" ||
    node.tag === "iframe"
  );
}
