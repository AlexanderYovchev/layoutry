"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import {
  canAddNavigationLink,
  getNavigationLinks,
  NAVIGATION_LINK_WRAP_HINT_THRESHOLD,
  type NavigationLinkMoveDirection,
} from "@/features/editor/commands/navigationLinkCommands";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getFlexContainerSettings, getFlowLayoutSettings } from "@/features/editor/types/flowLayout";
import { getLayoutMode } from "@/features/editor/types/layout";
import { getLinkHref } from "@/features/editor/types/link";
import type { EditorElementNode } from "@/features/editor/types/document";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { formatNavigationLinkCount, NAVIGATION_LINKS_COPY } from "@/features/inspector/utils/navigationLinksCopy";
import { cn } from "@/lib/utils";

interface InspectorNavigationLinksSectionProps {
  /** The selected `nav` (see InspectorNodeSummary). */
  node: EditorElementNode;
}

const NOTE_CLASS_NAME = "px-0.5 text-[11px] text-fg-secondary";
const ICON_BUTTON_CLASS_NAME =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300";
const REMOVE_BUTTON_CLASS_NAME = cn(ICON_BUTTON_CLASS_NAME, "hover:text-red-600 dark:hover:text-red-400");
const ADD_BUTTON_CLASS_NAME =
  "flex h-7 items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 text-xs text-zinc-500 transition-colors duration-150 hover:border-zinc-400 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:border-zinc-300 aria-disabled:hover:text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300";

type RowControl = "up" | "down" | "remove";

interface FocusRequest {
  /** A link id, or null for the Add link button. */
  linkId: string | null;
  control: RowControl;
}

/** Each row's name for screen readers: its text, plus its position when another link has the same text. */
function rowNames(links: readonly EditorElementNode[]): string[] {
  const labels = links.map((link) => link.text?.trim() || NAVIGATION_LINKS_COPY.untitled);
  return labels.map((label, index) =>
    labels.filter((other) => other === label).length > 1 ? `${label} (link ${index + 1})` : label,
  );
}

/** Whether the nav is a Flex row/column whose existing Wrap control is off, so the Wrap advice is actionable. */
function wrapHintApplies(node: EditorElementNode, linkCount: number): boolean {
  if (linkCount < NAVIGATION_LINK_WRAP_HINT_THRESHOLD) return false;
  if (getLayoutMode(node) === "free" || getFlowLayoutSettings(node).display !== "flex") return false;
  return getFlexContainerSettings(node).wrap !== "wrap";
}

/**
 * Navigation links (BC-06.2): the direct `<a>` children of the selected
 * `nav`, with Move up / Move down / Remove per row and "Add link" below.
 * Every other child of the nav (a CTA Button, separators) is not listed and
 * never touched — see navigationLinkCommands.ts for the eligibility and
 * ordering rules. Structural, not a style edit, so it sits outside Parent
 * Style Protection like the List / Table / Select sections.
 *
 * Focus never drops to the page: after Remove it moves to the next row's
 * Remove button (or the previous one, then Add link); after a move it stays
 * on the same control of the moved row, or its other Move button once the
 * row reaches an end. "Add link" stays focusable at the maximum
 * (aria-disabled, with the reason as its description).
 */
export function InspectorNavigationLinksSection({ node }: InspectorNavigationLinksSectionProps) {
  const addNavigationLink = useEditorStore((state) => state.addNavigationLink);
  const removeNavigationLink = useEditorStore((state) => state.removeNavigationLink);
  const moveNavigationLink = useEditorStore((state) => state.moveNavigationLink);
  const selectElement = useEditorStore((state) => state.selectElement);

  const links = getNavigationLinks(node);
  const names = rowNames(links);
  const canAdd = canAddNavigationLink(node);
  const showWrapHint = wrapHintApplies(node, links.length);

  const maximumNoteId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const focusRequest = useRef<FocusRequest | null>(null);

  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    if (request.linkId === null) {
      addButtonRef.current?.focus();
      return;
    }
    const row = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-navigation-link-id]") ?? []).find(
      (element) => element.dataset.navigationLinkId === request.linkId,
    );
    const wanted = row?.querySelector<HTMLButtonElement>(`[data-row-control="${request.control}"]`);
    if (wanted && !wanted.disabled) {
      wanted.focus();
      return;
    }
    // The moved row reached an end of the list: its other Move button.
    const other = row?.querySelector<HTMLButtonElement>(`[data-row-control="${request.control === "up" ? "down" : "up"}"]`);
    if (other && !other.disabled) other.focus();
    else row?.querySelector<HTMLButtonElement>('[data-row-control="remove"]')?.focus();
  });

  function handleMove(linkId: string, direction: NavigationLinkMoveDirection) {
    focusRequest.current = { linkId, control: direction };
    moveNavigationLink(node.id, linkId, direction);
  }

  function handleRemove(index: number) {
    const next = links[index + 1] ?? links[index - 1];
    focusRequest.current = next ? { linkId: next.id, control: "remove" } : { linkId: null, control: "remove" };
    removeNavigationLink(node.id, links[index].id);
  }

  function handleAdd() {
    if (!canAdd) return;
    addNavigationLink(node.id);
  }

  return (
    <InspectorSection label={NAVIGATION_LINKS_COPY.title} defaultOpen>
      <div className="flex flex-col gap-2">
        <p aria-live="polite" className="px-0.5 text-[11px] font-medium text-fg-secondary">
          {formatNavigationLinkCount(links.length)}
        </p>

        {links.length > 0 && (
          <div ref={listRef} role="list" aria-label={NAVIGATION_LINKS_COPY.title} className="flex flex-col gap-0.5">
            {links.map((link, index) => {
              const name = names[index];
              return (
                <div
                  key={link.id}
                  role="listitem"
                  data-navigation-link-id={link.id}
                  className="flex min-w-0 items-center gap-0.5 rounded-md px-0.5"
                >
                  <button
                    type="button"
                    onClick={() => selectElement(link.id)}
                    aria-label={`Select ${name}`}
                    title={NAVIGATION_LINKS_COPY.selectTitle}
                    className="flex min-w-0 flex-1 flex-col rounded-md px-1 py-0.5 text-left hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:hover:bg-zinc-800"
                  >
                    <span className="truncate text-xs text-fg-primary">{link.text?.trim() || NAVIGATION_LINKS_COPY.untitled}</span>
                    <span className="truncate text-[11px] text-fg-secondary">{getLinkHref(link)}</span>
                  </button>
                  <button
                    type="button"
                    data-row-control="up"
                    disabled={index === 0}
                    onClick={() => handleMove(link.id, "up")}
                    aria-label={`Move ${name} up`}
                    title={`Move ${name} up`}
                    className={ICON_BUTTON_CLASS_NAME}
                  >
                    <ChevronUp aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    data-row-control="down"
                    disabled={index === links.length - 1}
                    onClick={() => handleMove(link.id, "down")}
                    aria-label={`Move ${name} down`}
                    title={`Move ${name} down`}
                    className={ICON_BUTTON_CLASS_NAME}
                  >
                    <ChevronDown aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    data-row-control="remove"
                    onClick={() => handleRemove(index)}
                    aria-label={`Remove ${name}`}
                    title={`Remove ${name}`}
                    className={REMOVE_BUTTON_CLASS_NAME}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          ref={addButtonRef}
          type="button"
          onClick={handleAdd}
          aria-disabled={canAdd ? undefined : true}
          aria-describedby={canAdd ? undefined : maximumNoteId}
          title={canAdd ? NAVIGATION_LINKS_COPY.addLinkTitle : NAVIGATION_LINKS_COPY.maximum}
          className={ADD_BUTTON_CLASS_NAME}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {NAVIGATION_LINKS_COPY.addLink}
        </button>

        {!canAdd && (
          <p id={maximumNoteId} className={NOTE_CLASS_NAME}>
            {NAVIGATION_LINKS_COPY.maximumNote}
          </p>
        )}
        {showWrapHint && (
          <p className={NOTE_CLASS_NAME}>
            {NAVIGATION_LINKS_COPY.wrapHint}
          </p>
        )}
      </div>
    </InspectorSection>
  );
}
