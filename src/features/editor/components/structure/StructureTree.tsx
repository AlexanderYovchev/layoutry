"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  findAncestorIds,
  getVisibleNodeIds,
} from "@/features/editor/components/structure/documentTreeUtils";
import { StructureTreeNode } from "@/features/editor/components/structure/StructureTreeNode";
import { StructureDropIndicator } from "@/features/editor/components/structure/StructureDropIndicator";
import { STRUCTURE_PAGE_END_ATTRIBUTE, STRUCTURE_TREE_ATTRIBUTE } from "@/features/editor/components/structure/structureDragDrop";
import { collectNodeIds } from "@/features/editor/utils/collectNodeIds";
import {
  describeMovedPosition,
  resolveKeyboardMove,
  type StructureMoveDirection,
} from "@/features/editor/components/structure/structureKeyboardMove";
import { moveRejectedMessage } from "@/features/editor/commands/moveCommands";
import { useStructureDragDrop } from "@/features/editor/hooks/useStructureDragDrop";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";

// BC-12.3: every row callback below is stable while the document and the
// open branches are unchanged (useCallback), and rows are memoized, so a
// drag's hover indicator re-renders only the indicator, not every row.
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
  const wrapperRef = useRef<HTMLDivElement>(null);

  // BC-12.2: what the last keyboard move did, for screen readers. A
  // trailing no-break space alternates so an identical message (e.g. two
  // refused moves in a row) is still announced again. BC-12.3: pointer
  // drags announce here too.
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback((message: string) => {
    setAnnouncement((current) => (current.endsWith(" ") ? message : `${message} `));
  }, []);

  // BC-12.2: the row to focus once a move has re-rendered the tree (a row
  // moved to another parent is a new element).
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingFocusId) return;
    const row = rowRefs.current.get(pendingFocusId);
    if (!row) return;
    row.focus();
    row.scrollIntoView({ block: "nearest" });
    setPendingFocusId(null);
  }, [pendingFocusId, documentTree, openNodeIds]);

  const registerRowRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(id, el);
    } else {
      rowRefs.current.delete(id);
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    setOpenNodeIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expand = useCallback((ids: readonly string[]) => {
    setOpenNodeIds((current) => {
      const missing = ids.filter((id) => !current.has(id));
      return missing.length === 0 ? current : new Set([...current, ...missing]);
    });
  }, []);

  const handleMoveFocus = useCallback(
    (fromId: string, direction: 1 | -1) => {
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
    },
    [documentTree, openNodeIds],
  );

  // After a successful move (keyboard or pointer): open the new ancestors,
  // keep focus on the moved row, and announce where it now is.
  const revealMoved = useCallback(
    (id: string, message?: string) => {
      const after = useEditorStore.getState().document;
      expand(findAncestorIds(after, id));
      setCurrentNodeId(id);
      setPendingFocusId(id);
      // BC-12.4: a multi-drag passes its own group description.
      announce(message ?? describeMovedPosition(after, id));
    },
    [announce, expand],
  );

  // BC-12.2 (D11): Alt+Arrow moves the focused row (only that row, never
  // the rest of a multi-selection) through the store's shared moveElement.
  // The moved element is selected, its new parent is expanded, focus stays
  // on its row, and the result is announced from the document itself.
  const handleReorder = useCallback(
    (id: string, direction: StructureMoveDirection) => {
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
      revealMoved(id);
    },
    [announce, documentTree, moveElement, revealMoved],
  );

  // BC-12.2: WAI-ARIA tree Left/Right. Right opens a closed branch, or
  // moves to its first child when open; Left closes an open branch, or
  // moves to the parent.
  const handleHorizontalKey = useCallback(
    (id: string, key: "ArrowLeft" | "ArrowRight") => {
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
    },
    [documentTree, handleToggle, openNodeIds],
  );

  const handleSelect = useCallback(
    (id: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
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
    },
    [addToSelection, documentTree, openNodeIds, selectOnly, selectRange, toggleSelection],
  );

  const handleMoveToEdge = useCallback(
    (edge: "first" | "last") => {
      const visibleIds = getVisibleNodeIds(documentTree, openNodeIds);
      if (visibleIds.length === 0) return;
      const nextId =
        edge === "first" ? visibleIds[0] : visibleIds[visibleIds.length - 1];
      rowRefs.current.get(nextId)?.focus();
    },
    [documentTree, openNodeIds],
  );

  // BC-12.3: pointer drag from the row handles (one element at a time).
  const { indicator: dropIndicator, dragging } = useStructureDragDrop({
    documentTree,
    openNodeIds,
    wrapperRef,
    rowRefs,
    expand,
    onMoved: revealMoved,
    announce,
  });

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
      {/* BC-12.2 / BC-12.3: the result of an Alt+Arrow move or a pointer drag. */}
      <p role="status" aria-live="polite" data-structure-move-announcement="" className="sr-only">
        {announcement}
      </p>
      <div ref={wrapperRef} className="relative" {...{ [STRUCTURE_TREE_ATTRIBUTE]: "" }}>
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
        {/* BC-12.3.1: while a row is dragged, a drop area under the last row appends it to the end of the page. */}
        {dragging && (
          <div
            aria-hidden="true"
            {...{ [STRUCTURE_PAGE_END_ATTRIBUTE]: "" }}
            className="rounded-control border-line text-fg-muted mt-1 flex h-10 items-center border border-dashed px-3 text-[11px]"
          >
            <span className="min-w-0 truncate">Drop here to move to the end of the page</span>
          </div>
        )}
        {dropIndicator && <StructureDropIndicator indicator={dropIndicator} />}
      </div>
    </>
  );
}
