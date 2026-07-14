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
  selectedElementId: string | null;
  openNodeIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  registerRowRef: (id: string, el: HTMLDivElement | null) => void;
}

export function StructureTreeNode({
  node,
  depth,
  selectedElementId,
  openNodeIds,
  onToggle,
  onSelect,
  registerRowRef,
}: StructureTreeNodeProps) {
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isOpen = openNodeIds.has(node.id);
  const isSelected = node.id === selectedElementId;
  const displayName = getElementDisplayName(node);
  const Icon = TAG_ICONS[node.tag] ?? FALLBACK_ELEMENT_ICON;

  function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(node.id);
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
        tabIndex={0}
        title={displayName}
        onClick={() => onSelect(node.id)}
        onKeyDown={handleRowKeyDown}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500",
          indentClassName(depth),
          isSelected
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={handleToggleClick}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${displayName}`}
            className="flex size-4 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-300"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "size-3.5 transition-transform",
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
            className="shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-600"
          >
            {node.tag}
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <div role="group">
          {children.map((child) => (
            <StructureTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedElementId={selectedElementId}
              openNodeIds={openNodeIds}
              onToggle={onToggle}
              onSelect={onSelect}
              registerRowRef={registerRowRef}
            />
          ))}
        </div>
      )}
    </>
  );
}
