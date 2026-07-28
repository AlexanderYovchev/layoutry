"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CanvasOverlay } from "@/features/canvas/components/overlay/CanvasOverlay";
import { DocumentNodeRenderer } from "@/features/canvas/components/document/DocumentNodeRenderer";
import { isSelectableElement } from "@/features/editor/rules/elementCapabilities";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
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
  const selectElement = useEditorStore((state) => state.selectElement);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const selectedElementId = useEditorStore((state) => state.selectedElementId);

  // Reveals the selected node whenever selection changes — including a
  // newly inserted node, which may render below the fold. scrollIntoView
  // with block "nearest" is a no-op when the node is already visible, so
  // this never causes distracting scrolling on an ordinary re-selection.
  useEffect(() => {
    if (!selectedElementId) return;
    const target = canvasRootRef.current?.querySelector(
      `[data-node-id="${CSS.escape(selectedElementId)}"]`,
    );
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedElementId]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
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
        // than selecting it.
        clearSelection();
        return;
      }

      selectElement(nodeId);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      clearSelection();
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectElement, clearSelection]);

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
      <DocumentNodeRenderer
        node={documentModel}
        parentId={null}
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />
      <CanvasOverlay canvasRootRef={canvasRootRef} hoveredNodeId={hoveredNodeId} />
    </div>
  );
}
