"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  findAncestorIds,
  getVisibleNodeIds,
} from "@/features/editor/components/structure/documentTreeUtils";
import { StructureTreeNode } from "@/features/editor/components/structure/StructureTreeNode";

export function StructureTree() {
  const documentTree = useEditorStore((state) => state.document);
  const selection = useEditorStore((state) => state.selection);
  const selectedElementId = selection.primaryId ?? null;
  const selectOnly = useEditorStore((state) => state.selectOnly);
  const toggleSelection = useEditorStore((state) => state.toggleSelection);
  const addToSelection = useEditorStore((state) => state.addToSelection);

  // The page root and its immediate children (top-level containers) are
  // expanded by default; everything deeper starts collapsed.
  const [openNodeIds, setOpenNodeIds] = useState<Set<string>>(() => {
    const initial = new Set<string>([documentTree.id]);
    for (const child of documentTree.children ?? []) {
      initial.add(child.id);
    }
    return initial;
  });

  // The tree's single roving tab stop (WAI-ARIA treeview pattern) — every
  // other row is tabIndex=-1. Defaults to the root until the user focuses
  // or selects something else.
  const [currentNodeId, setCurrentNodeId] = useState(documentTree.id);

  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  function registerRowRef(id: string, el: HTMLDivElement | null) {
    if (el) {
      rowRefs.current.set(id, el);
    } else {
      rowRefs.current.delete(id);
    }
  }

  function handleToggle(id: string) {
    setOpenNodeIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleMoveFocus(fromId: string, direction: 1 | -1) {
    const visibleIds = getVisibleNodeIds(documentTree, openNodeIds);
    const index = visibleIds.indexOf(fromId);
    if (index === -1) return;
    // Tree navigation doesn't wrap at the ends (unlike a menubar/toolbar) —
    // Up at the first row and Down at the last row simply stay put.
    const nextIndex = Math.min(
      Math.max(index + direction, 0),
      visibleIds.length - 1,
    );
    const nextId = visibleIds[nextIndex];
    rowRefs.current.get(nextId)?.focus();
  }

  function handleSelect(id: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) {
    if (event.ctrlKey || event.metaKey) {
      toggleSelection(id);
    } else if (event.shiftKey) {
      addToSelection(id);
    } else {
      selectOnly(id);
    }
  }

  function handleMoveToEdge(edge: "first" | "last") {
    const visibleIds = getVisibleNodeIds(documentTree, openNodeIds);
    if (visibleIds.length === 0) return;
    const nextId =
      edge === "first" ? visibleIds[0] : visibleIds[visibleIds.length - 1];
    rowRefs.current.get(nextId)?.focus();
  }

  // Synchronizes local expansion state with an external event (the
  // editor store's selection changing, whether from this tree or, once
  // it exists, the canvas). This is a one-time reaction, not a derived
  // value: ancestors are expanded when selection moves into a collapsed
  // branch, but the user can still collapse that branch afterward — it
  // doesn't force back open on every render.
  useEffect(() => {
    if (!selectedElementId) return;

    const ancestorIds = findAncestorIds(documentTree, selectedElementId);
    if (ancestorIds.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to an external selection change, not deriving a render-time value
      setOpenNodeIds((current) => {
        const missing = ancestorIds.filter((id) => !current.has(id));
        if (missing.length === 0) return current;
        return new Set([...current, ...missing]);
      });
    }

    setCurrentNodeId(selectedElementId);
    rowRefs.current
      .get(selectedElementId)
      ?.scrollIntoView({ block: "nearest" });
    // documentTree is intentionally omitted: this should only react to the
    // selection changing, not to unrelated document updates re-expanding a
    // branch the user has since collapsed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElementId]);

  return (
    <div role="tree" aria-label="Page structure">
      <StructureTreeNode
        node={documentTree}
        depth={0}
        selectedIds={selection.ids}
        primarySelectedId={selectedElementId}
        openNodeIds={openNodeIds}
        currentNodeId={currentNodeId}
        onToggle={handleToggle}
        onSelect={handleSelect}
        onFocusRow={setCurrentNodeId}
        onMoveFocus={handleMoveFocus}
        onMoveToEdge={handleMoveToEdge}
        registerRowRef={registerRowRef}
      />
    </div>
  );
}
