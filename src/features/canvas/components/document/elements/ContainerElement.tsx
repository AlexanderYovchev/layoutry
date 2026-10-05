"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveAspectRatioStyle } from "@/features/canvas/utils/resolveAspectRatioStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolveFlowLayoutStyle } from "@/features/canvas/utils/resolveFlowLayoutStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveShapeStyle } from "@/features/canvas/utils/resolveShapeStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { cn, mergeRefs } from "@/lib/utils";
import { getLayoutMode } from "@/features/editor/types/layout";
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

  const isFreeChild = parentLayoutMode === "free";
  const ownLayoutMode = getLayoutMode(node);
  // A Free child already renders position: absolute (see freeChildStyle),
  // which already qualifies it as a containing block for its own
  // absolutely-positioned Free children — position: relative is only
  // needed to establish that when this container isn't itself a Free
  // child (otherwise flow's default position: static would let its Free
  // children's left/top resolve against some ancestor further up instead
  // of this container).
  const hostsOwnFreeChildren = ownLayoutMode === "free" && !isFreeChild;

  // A node with no explicit flowLayout/spacing predates Checkpoint 3.5 —
  // the Tailwind classes below (originally this app's only container
  // presentation) are its fallback, kept byte-for-byte so nothing already
  // built or tested regresses. Once a container has an explicit
  // flowLayout (every newly created one — see elementFactories.ts) or
  // spacing, the data-driven inline styles below take over instead.
  const usesLegacyFlexClasses = !node.flowLayout;
  const usesLegacyPadding = !node.spacing;
  // The faint "border border-zinc-100" class below predates real border
  // data (Checkpoint 4.4) — pure editor chrome so an empty container
  // still reads as a box in the builder. Once a node has explicit border
  // settings, this chrome must get out of the way entirely (not just on
  // whichever sides happen to be configured), so an "Individual Sides"
  // border on only one edge doesn't leave the other three showing a
  // phantom chrome border that looks like real, if very faint, data.
  const usesLegacyBorderChrome = !node.border;
  // The "rounded-lg" class below is the same kind of pre-4.5 editor
  // chrome as the border classes above — a default cosmetic corner
  // rounding with no relation to real radius data. Gated the same way,
  // for the same reason: left ungated, an "Individual Corners" radius on
  // only one corner would leave the other three still showing this
  // default rounding, indistinguishable from real (if coincidentally
  // identical) data.
  const usesLegacyRadiusChrome = !node.borderRadius;

  // Tailwind's Preflight resets ul/ol to list-style: none (a common CSS-
  // reset default, applied globally, not something this checkpoint
  // controls) — left alone, a <ul>/<ol> would render with no visible
  // bullets/numbers at all, defeating the point of the primitive. There
  // is no list-style Inspector control yet (out of scope — see this
  // checkpoint's report), so the className below applies a plain,
  // unconditional default rather than something a real setting could
  // override; list-inside keeps the marker within the content box
  // regardless of the 16px starter padding, so it never depends on
  // tuning a separate indent.

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
  // usesLegacyBorderChrome/usesLegacyPadding defaults already give both
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
      className={cn(
        usesLegacyRadiusChrome && "rounded-lg",
        usesLegacyBorderChrome && "border border-zinc-100 dark:border-zinc-900",
        usesLegacyFlexClasses && "flex flex-col items-start gap-4",
        usesLegacyPadding && "p-8",
        node.tag === "ul" && "list-disc list-inside",
        node.tag === "ol" && "list-decimal list-inside",
        isDragging && "opacity-40",
        node.className,
      )}
      style={{
        // resolvePositionStyle spread first, and both elementPositionStyle
        // and the hostsOwnFreeChildren override after (Checkpoint 5.1) — a
        // Free child's own position: absolute (via elementPositionStyle)
        // and a Free-hosting container's own position: relative (right
        // below) must always win over this checkpoint's general Position
        // control; see types/position.ts's own doc comment for the full
        // ownership conflict this resolves.
        ...resolvePositionStyle(node),
        ...elementPositionStyle(node, parentLayoutMode),
        ...resolveAspectRatioStyle(node),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        // Spread AFTER resolveFlexOrGridChildStyle deliberately (Checkpoint
        // 5.7) — see HeadingElement's identical comment for the full
        // reasoning (an explicit user min-width/min-height must win over
        // that resolver's own Flex/Grid containment default of 0).
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...(ownLayoutMode === "flow" ? resolveFlowLayoutStyle(node) : undefined),
        ...(hostsOwnFreeChildren ? { position: "relative" } : {}),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveDisplayStyle(node),
        ...resolveShapeStyle(node),
      }}
      {...listeners}
    >
      {children}
    </Tag>
  );
}
