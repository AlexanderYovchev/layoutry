"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findAncestorIds } from "@/features/editor/components/structure/documentTreeUtils";
import { StructureTreeNode } from "@/features/editor/components/structure/StructureTreeNode";

export function StructureTree() {
  const documentTree = useEditorStore((state) => state.document);
  const selectedElementId = useEditorStore((state) => state.selectedElementId);
  const selectElement = useEditorStore((state) => state.selectElement);

  // The page root and its immediate children (top-level containers) are
  // expanded by default; everything deeper starts collapsed.
  const [openNodeIds, setOpenNodeIds] = useState<Set<string>>(() => {
    const initial = new Set<string>([documentTree.id]);
    for (const child of documentTree.children ?? []) {
      initial.add(child.id);
    }
    return initial;
  });

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
        selectedElementId={selectedElementId}
        openNodeIds={openNodeIds}
        onToggle={handleToggle}
        onSelect={selectElement}
        registerRowRef={registerRowRef}
      />
    </div>
  );
}
