"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  findAncestorIds,
  getVisibleNodeIds,
} from "@/features/editor/components/structure/documentTreeUtils";
import { StructureTreeNode } from "@/features/editor/components/structure/StructureTreeNode";
import { collectNodeIds } from "@/features/editor/utils/collectNodeIds";
import {
  describeMovedPosition,
  resolveKeyboardMove,
  type StructureMoveDirection,
} from "@/features/editor/components/structure/structureKeyboardMove";
import { moveRejectedMessage } from "@/features/editor/commands/moveCommands";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";

export function StructureTree() {
  const documentTree = useEditorStore((state) => state.document);
  const selection = useEditorStore((state) => state.selection);
  const selectedElementId = selection.primaryId ?? null;
  const selectOnly = useEditorStore((state) => state.selectOnly);
  const toggleSelection = useEditorStore((state) => state.toggleSelection);
  const addToSelection = useEditorStore((state) => state.addToSelection);
  const selectRange = useEditorStore((state) => state.selectRange);
  const moveElement = useEditorStore((state) => state.moveElement);
  // BC-10.2: the count shown for a multi-selection (stale ids never count).
  const existingIds = useMemo(() => collectNodeIds(documentTree), [documentTree]);
  const selectedCount = selection.ids.filter((id) => existingIds.has(id)).length;

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

  // BC-12.2: what the last keyboard move did, for screen readers. A
  // trailing no-break space alternates so an identical message (e.g. two
  // refused moves in a row) is still announced again.
  const [announcement, setAnnouncement] = useState("");
  function announce(message: string) {
    setAnnouncement((current) => (current.endsWith("\u00A0") ? message : `${message}\u00A0`));
  }

  // BC-12.2: the row to focus once a keyboard move has re-rendered the tree
  // (a row moved to another parent is a new element).
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingFocusId) return;
    const row = rowRefs.current.get(pendingFocusId);
    if (!row) return;
    row.focus();
    row.scrollIntoView({ block: "nearest" });
    setPendingFocusId(null);
  }, [pendingFocusId, documentTree, openNodeIds]);

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

  // BC-12.2 (D11): Alt+Arrow moves the focused row (only that row, never
  // the rest of a multi-selection) through the store's shared moveElement.
  // The moved element is selected, its new parent is expanded, focus stays
  // on its row, and the result is announced from the document itself.
  function handleReorder(id: string, direction: StructureMoveDirection) {
    const request = resolveKeyboardMove(documentTree, id, direction);
    if (request.kind === "unavailable") {
      announce(request.message);
      return;
    }
    const node = findNodeById(documentTree, id);
    const name = node ? getElementDisplayName(node) : "The element";
    const outcome = moveElement(id, request.targetId, request.zone);
    if (outcome.status === "rejected") {
      announce(moveRejectedMessage(name, outcome.reason));
      return;
    }
    if (outcome.status === "unchanged") {
      announce(`${name} is already there.`);
      return;
    }
    const after = useEditorStore.getState().document;
    const ancestorIds = findAncestorIds(after, id);
    setOpenNodeIds((current) => {
      const missing = ancestorIds.filter((ancestorId) => !current.has(ancestorId));
      return missing.length === 0 ? current : new Set([...current, ...missing]);
    });
    setCurrentNodeId(id);
    setPendingFocusId(id);
    announce(describeMovedPosition(after, id));
  }

  // BC-12.2: WAI-ARIA tree Left/Right. Right opens a closed branch, or
  // moves to its first child when open; Left closes an open branch, or
  // moves to the parent.
  function handleHorizontalKey(id: string, key: "ArrowLeft" | "ArrowRight") {
    const node = findNodeById(documentTree, id);
    if (!node) return;
    const children = node.children ?? [];
    const isOpen = openNodeIds.has(id);
    if (key === "ArrowRight") {
      if (children.length === 0) return;
      if (!isOpen) handleToggle(id);
      else rowRefs.current.get(children[0].id)?.focus();
      return;
    }
    if (children.length > 0 && isOpen) {
      handleToggle(id);
      return;
    }
    const parentId = findParentId(documentTree, id);
    if (parentId) rowRefs.current.get(parentId)?.focus();
  }

  function handleSelect(id: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) {
    if (event.shiftKey) {
      // BC-10.2: a contiguous range over the VISIBLE rows (collapsed
      // descendants are skipped, containers are crossed), from the anchor
      // to this row; with Ctrl/Cmd it is added to the selection. The page
      // root is never part of a range. Shift on the Canvas stays additive.
      const visibleIds = getVisibleNodeIds(documentTree, openNodeIds).filter(
        (visibleId) => visibleId !== documentTree.id,
      );
      if (id === documentTree.id) addToSelection(id);
      else selectRange(id, visibleIds, event.ctrlKey || event.metaKey);
    } else if (event.ctrlKey || event.metaKey) {
      toggleSelection(id);
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
    <>
      {/* BC-10.2: compact count for a multi-selection, in a polite live region. */}
      <p
        aria-live="polite"
        data-structure-selection-count=""
        className={
          selectedCount >= 2
            ? "px-2 pb-1 text-[11px] font-medium text-fg-secondary"
            : "sr-only"
        }
      >
        {selectedCount >= 2 ? `${selectedCount} selected` : ""}
      </p>
      {/* BC-12.2: the result of an Alt+Arrow move (D11). */}
      <p role="status" aria-live="polite" data-structure-move-announcement="" className="sr-only">
        {announcement}
      </p>
    <div role="tree" aria-label="Page structure" aria-multiselectable="true">
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
        onReorder={handleReorder}
        onHorizontalKey={handleHorizontalKey}
        registerRowRef={registerRowRef}
      />
    </div>
    </>
  );
}
