"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveContainerElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { cn, mergeRefs } from "@/lib/utils";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";
import type { FormEvent, MouseEvent as ReactMouseEvent } from "react";

const SEMANTIC_TAGS = new Set(["section", "ul", "ol", "header", "nav", "main", "article", "aside", "footer", "form", "label", "fieldset", "figure"]);
type SemanticTag = "section" | "ul" | "ol" | "header" | "nav" | "main" | "article" | "aside" | "footer" | "form" | "label" | "fieldset" | "figure";

/**
 * A real `<form>` submits (navigating/reloading the page) on Enter-in-a-
 * text-field or a submit button click — never appropriate while designing
 * a page (Checkpoint 1.10). The same preventDefault-only fix
 * LinkElement's preventEditorNavigation already uses for anchor
 * navigation: it stops the browser's default submission behavior without
 * touching event propagation (so the click/submit still bubbles normally)
 * and without faking the markup — the rendered element stays a genuine
 * `<form>`. Form's own `action`/`method` are out of this checkpoint's
 * scope (see this checkpoint's report), so there is nothing else for a
 * real submission to do here even if it weren't prevented.
 */
function preventEditorFormSubmission(event: FormEvent) {
  event.preventDefault();
}

/**
 * A real `<label>` wrapping a labelable control (e.g. an Input) has a
 * browser-native "activation behavior": clicking anywhere in the label
 * redirects focus/activation to that descendant control (Checkpoint
 * 1.11). Inside the editor this would fight ordinary Canvas selection —
 * clicking a Label to select it must not also silently focus its child
 * Input, which would both look like unintended activation AND hand the
 * child real DOM focus outside a deliberate useNativeInputEditing
 * session (the same isEditableTarget/keyboard-shortcut hazard Checkpoint
 * 1.10 already had to design around for a plain click on Input itself).
 * preventDefault() on the label's own click is the standard, minimal way
 * to suppress just that native redirect — MDN documents this explicitly
 * — without touching propagation (selection still bubbles normally) or
 * faking the markup.
 */
function preventEditorLabelActivation(event: ReactMouseEvent) {
  event.preventDefault();
}

export function ContainerElement({
  node,
  parentId,
  parentLayoutMode,
  parentFlowDisplay,
  children,
}: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");

  const recipe = resolveContainerElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

  // Container (div), Section (section), Unordered/Ordered List (ul/ol),
  // the semantic sectioning family (header/nav/main/article/aside/
  // footer — Checkpoint 1.8), Form (form — Checkpoint 1.10), Label
  // (label — Checkpoint 1.11), Fieldset (fieldset — Checkpoint
  // 1.15.6.12.1), and Figure (figure — Checkpoint 1.15.6.12.2) are all the
  // tags registered to this component (see documentNodeComponents.ts) —
  // every one of them shares the exact same structural-container style/
  // behavior below (the same Block-display starter defaults; see
  // createUnorderedListNode/createHeaderNode/createFormNode/
  // createLabelNode/createFieldsetNode/createFigureNode/etc.) and differs
  // only in semantic DOM identity, so the real element tag is chosen from
  // the document node rather than hardcoded, keeping generated markup a
  // genuine <header>/<nav>/<main>/<article>/<aside>/<footer>/<ul>/<ol>/
  // <section>/<form>/<label>/<fieldset>/<figure> instead of a <div>
  // standing in for one. Fieldset/Figure need no onSubmit/onClick special-
  // case the way Form/Label do. Verified directly against Tailwind's own
  // preflight.css (not assumed): the universal `*, ::before, ::after,
  // ::backdrop, ::file-selector-button { margin: 0; padding: 0; border: 0
  // solid; }` reset already zeroes a bare <fieldset>/<figure>'s native
  // margin/padding/border exactly like every other element (no fieldset-
  // or figure-specific Preflight rule exists, unlike <hr>'s own — see
  // DividerElement's doc comment), so this component's own
  // container-border/container-padding defaults (elementStyleRecipes.ts) already give both
  // the exact same sensible starting appearance every other container
  // gets, with no native styling left to fight.
  const Tag = SEMANTIC_TAGS.has(node.tag) ? (node.tag as SemanticTag) : "div";

  return (
    <Tag
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      {...(node.tag === "form" ? { onSubmit: preventEditorFormSubmission } : undefined)}
      {...(node.tag === "label" ? { onClick: preventEditorLabelActivation } : undefined)}
      className={cn(documentDefaultClasses(recipe.defaults), isDragging && "opacity-40", node.className)}
      style={recipe.style}
      {...listeners}
    >
      {children}
    </Tag>
  );
}
