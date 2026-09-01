"use client";

import { ChevronRight } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { cn } from "@/lib/utils";
import {
  FALLBACK_ELEMENT_ICON,
  TAG_ICONS,
} from "@/features/editor/components/structure/elementIcon";
import {
  getElementDisplayName,
  shouldShowTagBadge,
} from "@/features/editor/utils/elementDisplayName";
import type { EditorElementNode } from "@/features/editor/types/document";

// Bounded lookup so indentation stays on the canonical Tailwind spacing
// scale instead of an inline style; six levels comfortably covers a
// realistic page outline.
const indentClassesByDepth = [
  "pl-1.5",
  "pl-5",
  "pl-9",
  "pl-13",
  "pl-17",
  "pl-21",
] as const;

function indentClassName(depth: number) {
  return indentClassesByDepth[Math.min(depth, indentClassesByDepth.length - 1)];
}

interface StructureTreeNodeProps {
  node: EditorElementNode;
  depth: number;
  /** Every currently-selected node's own editor id (Checkpoint 1.15.2) — a row highlights whenever its own id is a member, not just when it's the primary. */
  selectedIds: readonly string[];
  primarySelectedId: string | null;
  openNodeIds: Set<string>;
  /** The tree's single roving tab stop (WAI-ARIA treeview pattern) — every other row is tabIndex=-1. */
  currentNodeId: string;
  onToggle: (id: string) => void;
  onSelect: (id: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  onFocusRow: (id: string) => void;
  onMoveFocus: (fromId: string, direction: 1 | -1) => void;
  onMoveToEdge: (edge: "first" | "last") => void;
  registerRowRef: (id: string, el: HTMLDivElement | null) => void;
}

export function StructureTreeNode({
  node,
  depth,
  selectedIds,
  primarySelectedId,
  openNodeIds,
  currentNodeId,
  onToggle,
  onSelect,
  onFocusRow,
  onMoveFocus,
  onMoveToEdge,
  registerRowRef,
}: StructureTreeNodeProps) {
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isOpen = openNodeIds.has(node.id);
  const isSelected = selectedIds.includes(node.id);
  const isPrimary = node.id === primarySelectedId;
  const displayName = getElementDisplayName(node);
  const Icon = TAG_ICONS[node.tag] ?? FALLBACK_ELEMENT_ICON;

  function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        onSelect(node.id, { ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey });
        break;
      case "ArrowDown":
        event.preventDefault();
        onMoveFocus(node.id, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        onMoveFocus(node.id, -1);
        break;
      case "Home":
        event.preventDefault();
        onMoveToEdge("first");
        break;
      case "End":
        event.preventDefault();
        onMoveToEdge("last");
        break;
    }
  }

  function handleToggleClick(event: MouseEvent) {
    event.stopPropagation();
    onToggle(node.id);
  }

  return (
    <>
      <div
        ref={(el) => registerRowRef(node.id, el)}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-level={depth + 1}
        tabIndex={node.id === currentNodeId ? 0 : -1}
        title={displayName}
        onClick={(event: MouseEvent) =>
          onSelect(node.id, { ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey })
        }
        onFocus={() => onFocusRow(node.id)}
        onKeyDown={handleRowKeyDown}
        className={cn(
          "flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm transition-colors duration-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 active:bg-zinc-200 dark:active:bg-zinc-800",
          indentClassName(depth),
          isPrimary
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
            : isSelected
              ? "bg-blue-50 text-zinc-900 dark:bg-blue-950 dark:text-zinc-100"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={handleToggleClick}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${displayName}`}
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors duration-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "size-3.5 transition-transform duration-200 ease-out",
                isOpen && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="size-4 shrink-0" />
        )}

        <Icon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-zinc-400 dark:text-zinc-500"
        />

        <span className="min-w-0 flex-1 truncate">{displayName}</span>

        {shouldShowTagBadge(node) && (
          <span
            aria-hidden="true"
            className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400"
          >
            {node.tag}
          </span>
        )}
      </div>

      {hasChildren && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div role="group" inert={!isOpen}>
              {children.map((child) => (
                <StructureTreeNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  selectedIds={selectedIds}
                  primarySelectedId={primarySelectedId}
                  openNodeIds={openNodeIds}
                  currentNodeId={currentNodeId}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onFocusRow={onFocusRow}
                  onMoveFocus={onMoveFocus}
                  onMoveToEdge={onMoveToEdge}
                  registerRowRef={registerRowRef}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
