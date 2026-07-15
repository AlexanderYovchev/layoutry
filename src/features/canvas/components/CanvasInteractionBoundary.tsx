"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CanvasOverlay } from "@/features/canvas/components/overlay/CanvasOverlay";
import { DocumentNodeRenderer } from "@/features/canvas/components/document/DocumentNodeRenderer";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

interface CanvasInteractionBoundaryProps {
  document: EditorElementNode;
}

function resolveHoverableNodeId(
  target: EventTarget | null,
  rootId: string,
): string | null {
  if (!(target instanceof Element)) return null;
  const nodeElement = target.closest<HTMLElement>("[data-node-id]");
  const nodeId = nodeElement?.getAttribute("data-node-id") ?? null;
  return nodeId && nodeId !== rootId ? nodeId : null;
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

      const nodeId = nodeElement.getAttribute("data-node-id");
      if (!nodeId || nodeId === documentModel.id) {
        // The pseudo document root has no canvas visual identity of its
        // own — clicking it (or blank page-sheet space) clears
        // selection rather than selecting the root.
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
  }, [documentModel.id, selectElement, clearSelection]);

  function handlePointerOver(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    setHoveredNodeId(resolveHoverableNodeId(event.target, documentModel.id));
  }

  function handlePointerOut(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const stillOverNode = resolveHoverableNodeId(
      event.relatedTarget,
      documentModel.id,
    );
    if (!stillOverNode) setHoveredNodeId(null);
  }

  return (
    <div
      ref={canvasRootRef}
      className="relative cursor-pointer"
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <DocumentNodeRenderer node={documentModel} parentId={null} />
      <CanvasOverlay canvasRootRef={canvasRootRef} hoveredNodeId={hoveredNodeId} />
    </div>
  );
}
