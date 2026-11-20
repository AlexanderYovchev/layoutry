"use client";

import type { ReactNode } from "react";
import type { StyleGroupKey } from "@/features/editor/types/styleClipboard";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";

const ACTION_CLASS_NAME =
  "h-7 rounded-md border border-zinc-200 px-2 text-left text-xs text-fg-primary transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-800";

export interface MixedSectionAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface InspectorMixedSectionPanelProps {
  label: string;
  /** What differs, e.g. "The selected elements have different box shadows." */
  description: string;
  actions: readonly MixedSectionAction[];
  /** Extra explanation (why an action is unavailable, what Reset does). */
  note?: ReactNode;
  /** BC-11.3: the CSS group the section owns, for its Copy/Paste CSS menu. */
  cssGroup?: StyleGroupKey;
}

/**
 * BC-10.4: the multi-selection state for a section whose value is a list
 * or a whole configuration (box shadows, a gradient, a container layout,
 * Flex/Grid child placement) when the selected elements differ. It shows
 * no editor, because there is no truthful single value to edit. Every
 * element keeps its own value until the user explicitly picks a shared
 * starting point ("Use … on all") or resets. Each action is one Undo
 * step; after it the elements agree, and the real editor appears.
 */
export function InspectorMixedSectionPanel({ label, description, actions, note, cssGroup }: InspectorMixedSectionPanelProps) {
  return (
    <InspectorSection label={label} cssGroup={cssGroup}>
      <div className="flex flex-col gap-1.5">
        <p className="px-0.5 text-[11px] text-fg-secondary">
          <span className="font-medium text-fg-primary">Mixed.</span> {description}
        </p>
        {actions.map((action) => (
          <button key={action.label} type="button" onClick={action.onSelect} disabled={action.disabled} className={ACTION_CLASS_NAME}>
            {action.label}
          </button>
        ))}
        {note && <p className="px-0.5 text-[11px] text-fg-secondary">{note}</p>}
      </div>
    </InspectorSection>
  );
}
