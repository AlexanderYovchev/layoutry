"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CanvasOverlay } from "@/features/canvas/components/overlay/CanvasOverlay";
import { DocumentNodeRenderer } from "@/features/canvas/components/document/DocumentNodeRenderer";
import { isEventInsideRelationshipRegion, resolveRelationshipElements } from "@/features/canvas/utils/relationshipContainment";
import { isSelectableElement } from "@/features/editor/rules/elementCapabilities";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findDismissibleRelationships } from "@/features/editor/utils/dismissibleTargets";
import type { EditorElementNode } from "@/features/editor/types/document";

interface CanvasInteractionBoundaryProps {
  document: EditorElementNode;
}

/**
 * The deepest data-node-id under the pointer, or null if that node's own
 * tag opts out of selection (see elementCapabilities) — the document root
 * and any other structural wrapper never becomes hoverable/selectable,
 * regardless of which specific id it happens to have.
 */
function resolveHoverableNodeId(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const nodeElement = target.closest<HTMLElement>("[data-node-id]");
  if (!nodeElement) return null;
  const nodeId = nodeElement.getAttribute("data-node-id");
  const nodeType = nodeElement.getAttribute("data-node-type");
  if (!nodeId || !nodeType || !isSelectableElement(nodeType)) return null;
  return nodeId;
}

/**
 * Owns Canvas selection interaction: one delegated window click listener
 * (rather than a handler per rendered node) resolves the deepest
 * data-node-id under the pointer and drives the shared editor store,
 * plus local hover state and the Escape-to-clear shortcut. Kept separate
 * from DocumentCanvas so the page-sheet chrome and the interaction/
 * overlay logic stay independently readable.
 */
export function CanvasInteractionBoundary({
  document: documentModel,
}: CanvasInteractionBoundaryProps) {
  const canvasRootRef = useRef<HTMLDivElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const selectOnly = useEditorStore((state) => state.selectOnly);
  const toggleSelection = useEditorStore((state) => state.toggleSelection);
  const addToSelection = useEditorStore((state) => state.addToSelection);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const primarySelectedId = useEditorStore((state) => state.selection.primaryId ?? null);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const executeInteractionsForNode = useEditorStore((state) => state.executeInteractionsForNode);
  const exitPreview = useEditorStore((state) => state.exitPreview);
  const runtimeVisibility = useEditorStore((state) => state.runtimeVisibility);
  const dismissRuntimeTarget = useEditorStore((state) => state.dismissRuntimeTarget);

  // Reveals the primary selected node whenever selection changes —
  // including a newly inserted node, which may render below the fold.
  // scrollIntoView with block "nearest" is a no-op when the node is
  // already visible, so this never causes distracting scrolling on an
  // ordinary re-selection. Only the primary scrolls into view for a
  // multi-selection (Checkpoint 1.15.2) — the same "one anchor" role it
  // already plays for the Inspector/resize handles.
  useEffect(() => {
    if (!primarySelectedId) return;
    const target = canvasRootRef.current?.querySelector(
      `[data-node-id="${CSS.escape(primarySelectedId)}"]`,
    );
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [primarySelectedId]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // Outside-click dismissal (Checkpoint 1.15.6.8.3, Part C) — Preview
      // only; Design's own selection logic below is completely
      // untouched. Runs FIRST, as the opening step of this SAME click
      // handler, rather than a separate `pointerdown` listener — live
      // Chromium QA found a real event-ordering bug with the separate-
      // event approach: dismissing a relationship on `pointerdown` can
      // shrink the in-flow page (an open Dropdown menu collapsing) and
      // reflow content UPWARD before the browser's own follow-up `click`
      // for the SAME gesture fires, so that `click` can land on
      // whatever scrolled into its original screen coordinate instead of
      // the element the user actually meant to click (reproduced
      // concretely: clicking a second Dropdown's trigger while a first
      // one was open sent the `click` event to unrelated hero-section
      // text once the first menu's dismissal collapsed the layout).
      // Deciding dismissal AND this click's own selection/execution
      // within the SAME synchronous handler call means both state
      // updates land in one React batch — the reflow only ever happens
      // once, AFTER both decisions were already made against the
      // CURRENT (not-yet-reflowed) DOM, so there is no second event left
      // to mistarget. Never dismisses a relationship the click itself
      // falls inside (its own trigger/menu region) — that stays fully
      // owned by the ordinary toggle/no-op logic below. Only ever calls
      // dismissRuntimeTarget — an ephemeral, history-free write, exactly
      // like Escape dismissal uses.
      if (isPreview) {
        for (const relationship of findDismissibleRelationships(documentModel, runtimeVisibility)) {
          const { triggerElement, targetElement } = resolveRelationshipElements(document, relationship);
          if (!isEventInsideRelationshipRegion(target, triggerElement, targetElement)) {
            dismissRuntimeTarget(relationship.targetId);
          }
        }
      }

      // Clicks outside the Workspace region (toolbar, menus, Resource
      // Panel, Inspector) are none of the Canvas's business.
      if (!target.closest('main[aria-label="Workspace"]')) return;

      const nodeElement = target.closest<HTMLElement>("[data-node-id]");
      if (!nodeElement || !canvasRootRef.current?.contains(nodeElement)) {
        clearSelection();
        return;
      }

      const nodeId = resolveHoverableNodeId(nodeElement);
      if (!nodeId) {
        // The pseudo document root (and any other non-selectable
        // structural wrapper) has no canvas visual identity of its own —
        // clicking it (or blank page-sheet space) clears selection rather
        // than selecting it, regardless of any modifier held. In Preview
        // there is no selection concept to clear either — this is simply
        // a no-op click on blank space.
        if (!isPreview) clearSelection();
        return;
      }

      // Preview Mode (Checkpoint 1.15.6.8, Part F) — a click EXECUTES the
      // node's own authored click bindings (Design's own selection/
      // toggle/additive branches below never run) rather than selecting
      // it. Deliberately still reads `event.target` through the exact
      // same resolveHoverableNodeId path Design selection uses (no
      // second click-resolution mechanism to keep in sync), and this
      // handler never calls stopPropagation/preventDefault — the 1.15.6.7
      // audit's own "preventDefault only, never stopPropagation" event
      // invariant is preserved unchanged.
      if (isPreview) {
        executeInteractionsForNode(nodeId, "click");
        return;
      }

      // Checkpoint 1.15.2 — Ctrl/Cmd toggles membership; Shift is
      // additive-only (never a toggle — see addSelectionId's own doc
      // comment for why Canvas deliberately doesn't attempt a
      // coordinate-based "range" the way Structure's ordered rows can);
      // a plain click replaces the whole selection with just this node.
      if (event.ctrlKey || event.metaKey) {
        toggleSelection(nodeId);
      } else if (event.shiftKey) {
        addToSelection(nodeId);
      } else {
        selectOnly(nodeId);
      }
    }

    // Escape dismissal priority (Checkpoint 1.15.6.8.3, Part F) — an open
    // dismissible relationship (see findDismissibleRelationships' own
    // V1 signature: click->toggle, authored initially-hidden, currently
    // runtime-visible) is closed FIRST, one at a time; Preview itself is
    // only exited once none remain. No overlay stack is tracked to decide
    // WHICH one closes first when several are open — with no genuine
    // open-order information to rank them by (the audit's own
    // "don't invent timestamps" instruction), the first relationship
    // found in a plain document-order traversal is picked, which is
    // simply deterministic (repeatable given the same state), not a
    // claim about "most recently opened."
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (isPreview) {
        const relationships = findDismissibleRelationships(documentModel, runtimeVisibility);
        if (relationships.length > 0) {
          dismissRuntimeTarget(relationships[0].targetId);
          return;
        }
        // Escape is a convenience exit from Preview (section 57), never
        // the ONLY way out — the header's own Preview/Design toggle
        // always works too (see GlobalActions).
        exitPreview();
        return;
      }
      clearSelection();
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectOnly,
    toggleSelection,
    addToSelection,
    clearSelection,
    isPreview,
    executeInteractionsForNode,
    exitPreview,
    documentModel,
    runtimeVisibility,
    dismissRuntimeTarget,
  ]);

  function handlePointerOver(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    setHoveredNodeId(resolveHoverableNodeId(event.target));
  }

  function handlePointerOut(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const stillOverNode = resolveHoverableNodeId(event.relatedTarget);
    if (!stillOverNode) setHoveredNodeId(null);
  }

  return (
    <div
      ref={canvasRootRef}
      className="relative cursor-pointer"
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/*
       * isolate (CSS `isolation: isolate`) — editor-chrome/stacking-
       * context boundary, Checkpoint 5.3. Before this, a document node
       * given an explicit z-index (Position section, Checkpoint 5.3) and
       * a non-static position could win the CSS stacking-order comparison
       * against CanvasOverlay below (a `position: absolute` element with
       * `z-index: auto`): per the CSS stacking spec, "positioned
       * descendant with an explicit positive z-index" is a *later* paint
       * bucket than "positioned descendant with z-index: auto", and
       * neither this div nor CanvasInteractionBoundary's own root
       * established a stacking context of its own to contain that
       * comparison — a sufficiently high document z-index could paint a
       * document element over the selection outline, resize handles, and
       * hover/drop-indicator chrome (all of which live in CanvasOverlay,
       * a plain later sibling, not a descendant, of the document tree).
       *
       * `isolation: isolate` on this wrapper (around the document tree
       * only, not CanvasOverlay) forces every document descendant's own
       * z-index to be compared *only* against its document siblings,
       * inside this wrapper's own new stacking context — it can never
       * again escape to compete with CanvasOverlay, no matter how large a
       * z-index a document node is given, without clamping that value or
       * touching CanvasOverlay at all. This is the smallest fix
       * consistent with the existing architecture: CanvasOverlay was
       * already correctly positioned as a later sibling (not a
       * descendant) of the document tree; it only needed this boundary,
       * not a rewrite. The Inspector panel, toolbar, Structure panel, and
       * menus live in entirely separate DOM subtrees outside DocumentCanvas
       * (see AppShell/EditorApp) and were never reachable by document
       * z-index in the first place; native <dialog> modals (see
       * components/ui/Dialog.tsx) render in the browser's own top layer,
       * which no z-index of any kind can affect.
       */}
      <div className="isolate">
        <DocumentNodeRenderer
          node={documentModel}
          parentId={null}
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />
      </div>
      <CanvasOverlay canvasRootRef={canvasRootRef} hoveredNodeId={hoveredNodeId} />
    </div>
  );
}
