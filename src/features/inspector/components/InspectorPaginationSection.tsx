"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  canAddPaginationPage,
  canRemovePaginationPage,
  canShowPaginationEllipsis,
} from "@/features/editor/commands/paginationCommands";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { isValidLinkHref } from "@/features/editor/types/link";
import { getPaginationParts, type PaginationControlRole } from "@/features/editor/types/pagination";
// Deep import by necessity (BC-17.3.1 QA-5): the export feature's index.ts also
// loads the whole export engine, the shared stylesheet compiler and the export
// UI; the Inspector needs only this pure URL policy (one type-only import).
import { checkExportUrl } from "@/features/export/utils/exportUrlPolicy";
import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { formatPaginationSummary, PAGINATION_CONTROL_LABELS, PAGINATION_COPY } from "@/features/inspector/utils/paginationCopy";
import { cn } from "@/lib/utils";

interface InspectorPaginationSectionProps {
  /** The selected, marked Pagination nav (see InspectorNodeSummary). */
  node: EditorElementNode;
}

const NOTE_CLASS_NAME = "px-0.5 text-[11px] text-fg-secondary";
const ERROR_CLASS_NAME = "px-0.5 text-[11px] text-red-600 dark:text-red-400";
const FIELD_CLASS_NAME =
  "h-6 w-full min-w-0 rounded-md border bg-zinc-50 px-2 text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:bg-zinc-900 dark:text-zinc-300";
const SMALL_BUTTON_CLASS_NAME =
  "h-6 shrink-0 rounded-md px-1.5 text-[11px] text-fg-secondary transition-colors duration-150 hover:bg-zinc-100 hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:hover:bg-zinc-800";
const REMOVE_BUTTON_CLASS_NAME =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:bg-transparent aria-disabled:hover:text-zinc-400 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-red-400";
const ADD_BUTTON_CLASS_NAME =
  "flex h-7 items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 text-xs text-zinc-500 transition-colors duration-150 hover:border-zinc-400 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:border-zinc-300 aria-disabled:hover:text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300";

/** The destinations a Pagination page accepts: the Link field's rule plus the export's URL policy, so nothing is saved that the export would refuse. */
function isAcceptedDestination(value: string): boolean {
  return isValidLinkHref(value) && checkExportUrl(value, "link").ok;
}

interface CommitFieldProps {
  value: string;
  label: string;
  placeholder?: string;
  invalid: boolean;
  describedBy?: string;
  /** Returns false when the value was refused; the field then shows the stored value again. */
  onCommit: (value: string) => boolean;
}

/**
 * A draft/commit text field: Enter or blur commits once, Escape reverts,
 * an untouched blur commits nothing (no empty history entry). It resyncs
 * when the stored value changes (Undo, another page selected), the
 * last-seen-value pattern that avoids stale Inspector state.
 */
function CommitField({ value, label, placeholder, invalid, describedBy, onCommit }: CommitFieldProps) {
  const [draft, setDraft] = useState(value);
  const [touched, setTouched] = useState(false);
  const [lastValue, setLastValue] = useState(value);
  const skipBlur = useRef(false);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
    setTouched(false);
  }

  function commit() {
    if (!touched) return;
    setTouched(false);
    if (!onCommit(draft)) setDraft(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit();
      skipBlur.current = true;
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value);
      setTouched(false);
      skipBlur.current = true;
      event.currentTarget.blur();
    }
  }

  return (
    <input
      type="text"
      aria-label={label}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => {
        setDraft(event.target.value);
        setTouched(true);
      }}
      onBlur={() => {
        if (skipBlur.current) {
          skipBlur.current = false;
          return;
        }
        commit();
      }}
      onKeyDown={handleKeyDown}
      className={cn(FIELD_CLASS_NAME, invalid ? "border-red-400 dark:border-red-600" : "border-zinc-200 dark:border-zinc-800")}
    />
  );
}

interface PageRowProps {
  navId: string;
  page: EditorElementNode;
  position: number;
  canRemove: boolean;
  minimumNoteId: string;
  onRemove: () => void;
}

function PageRow({ navId, page, position, canRemove, minimumNoteId, onRemove }: PageRowProps) {
  const setCurrent = useEditorStore((state) => state.setPaginationCurrentPage);
  const setLabel = useEditorStore((state) => state.setPaginationPageLabel);
  const setHref = useEditorStore((state) => state.setPaginationPageHref);
  const selectElement = useEditorStore((state) => state.selectElement);
  const [labelError, setLabelError] = useState(false);
  const [destinationError, setDestinationError] = useState(false);
  const errorId = useId();
  const noteId = useId();
  const isCurrent = page.ariaCurrent === "page";
  const name = `page ${position}`;
  const label = page.text ?? "";

  return (
    <div role="listitem" data-pagination-page-id={page.id} className={cn("flex flex-col gap-1 rounded-md border px-1.5 py-1.5", isCurrent ? "border-accent/50 bg-accent/5" : "border-zinc-200 dark:border-zinc-800")}>
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={() => selectElement(page.id)}
          aria-label={`Select ${name}`}
          title="Select this page on the canvas to style it."
          className="min-w-0 flex-1 truncate rounded-md px-1 py-0.5 text-left text-xs font-medium text-fg-primary hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:hover:bg-zinc-800"
        >
          {`Page ${position}`}
        </button>
        {isCurrent ? (
          <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-fg-primary">{PAGINATION_COPY.current}</span>
        ) : (
          <button type="button" data-row-control="set-current" onClick={() => setCurrent(navId, page.id)} aria-label={`Set ${name} as the current page`} className={SMALL_BUTTON_CLASS_NAME}>
            {PAGINATION_COPY.setCurrent}
          </button>
        )}
        <button
          type="button"
          data-row-control="remove"
          onClick={() => canRemove && onRemove()}
          aria-disabled={canRemove ? undefined : true}
          aria-describedby={canRemove ? undefined : minimumNoteId}
          aria-label={`Remove ${name}`}
          title={canRemove ? `Remove ${name}` : PAGINATION_COPY.minimumNote}
          className={REMOVE_BUTTON_CLASS_NAME}
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <CommitField
        value={label}
        label={`Page ${position} ${PAGINATION_COPY.labelField.toLowerCase()}`}
        invalid={labelError}
        describedBy={labelError ? errorId : undefined}
        onCommit={(value) => {
          if (value.trim() === "") {
            setLabelError(true);
            return false;
          }
          setLabelError(false);
          setLabel(navId, page.id, value);
          return true;
        }}
      />
      <CommitField
        value={page.href ?? ""}
        label={`Page ${position} ${PAGINATION_COPY.destinationField.toLowerCase()}`}
        placeholder={PAGINATION_COPY.destinationPlaceholder}
        invalid={destinationError}
        describedBy={destinationError ? errorId : isCurrent ? noteId : undefined}
        onCommit={(value) => {
          const trimmed = value.trim();
          if (!isAcceptedDestination(trimmed)) {
            setDestinationError(true);
            return false;
          }
          setDestinationError(false);
          setHref(navId, page.id, trimmed);
          return true;
        }}
      />
      {(labelError || destinationError) && (
        <p id={errorId} role="alert" className={ERROR_CLASS_NAME}>
          {labelError ? PAGINATION_COPY.blankLabel : PAGINATION_COPY.invalidDestination}
        </p>
      )}
      {isCurrent && !destinationError && (
        <p id={noteId} className={NOTE_CLASS_NAME}>
          {PAGINATION_COPY.currentDestinationNote}
        </p>
      )}
    </div>
  );
}

const CONTROL_ORDER: readonly PaginationControlRole[] = ["previous", "next", "first", "last", "ellipsis"];

/** Whether the labels around the ellipsis are consecutive numbers, so "…" would suggest pages that don't exist. */
function ellipsisIsMisleading(node: EditorElementNode, ellipsis: EditorElementNode | undefined): boolean {
  if (!ellipsis) return false;
  const children = node.children ?? [];
  const index = children.indexOf(ellipsis);
  const before = children.slice(0, index).reverse().find((child) => child.tag === "a");
  const after = children.slice(index + 1).find((child) => child.tag === "a");
  const number = (child: EditorElementNode | undefined) => (child && /^\d+$/.test(child.text?.trim() ?? "") ? Number(child.text?.trim()) : undefined);
  const left = number(before);
  const right = number(after);
  return left !== undefined && right !== undefined && right === left + 1;
}

/**
 * Pagination (BC-09.3): manages a MARKED Pagination's pages (label,
 * destination, current page, add/remove) and its optional controls. Every
 * action is one store write and one Undo step (paginationCommands.ts); the
 * pages and controls stay ordinary nodes, selectable and stylable with
 * every CSS section. Legacy (unmarked) Paginations, Navbars and
 * Breadcrumbs keep the generic Navigation links section instead.
 */
export function InspectorPaginationSection({ node }: InspectorPaginationSectionProps) {
  const addPage = useEditorStore((state) => state.addPaginationPage);
  const removePage = useEditorStore((state) => state.removePaginationPage);
  const setControlVisible = useEditorStore((state) => state.setPaginationControlVisible);

  const { pages, controls } = getPaginationParts(node);
  const currentPosition = pages.findIndex((page) => page.ariaCurrent === "page") + 1;
  const canAdd = canAddPaginationPage(node);
  const canRemove = canRemovePaginationPage(node);
  const canShowEllipsis = canShowPaginationEllipsis(node);

  const maximumNoteId = useId();
  const minimumNoteId = useId();
  const ellipsisNoteId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const focusAfterRemove = useRef<string | null | undefined>(undefined);

  // After Remove, focus never drops to the page: the next row's Remove, or Add page.
  useEffect(() => {
    const request = focusAfterRemove.current;
    if (request === undefined) return;
    focusAfterRemove.current = undefined;
    const row = request === null ? null : listRef.current?.querySelector<HTMLElement>(`[data-pagination-page-id="${CSS.escape(request)}"]`);
    const target = row?.querySelector<HTMLButtonElement>('[data-row-control="remove"]') ?? addButtonRef.current;
    target?.focus();
  });

  function handleRemove(index: number) {
    const next = pages[index + 1] ?? pages[index - 1];
    focusAfterRemove.current = next ? next.id : null;
    removePage(node.id, pages[index].id);
  }

  return (
    <InspectorSection label={PAGINATION_COPY.title} defaultOpen>
      <div className="flex flex-col gap-2">
        <p aria-live="polite" className="px-0.5 text-[11px] font-medium text-fg-secondary">
          {formatPaginationSummary(pages.length, currentPosition)}
        </p>

        <div ref={listRef} role="list" aria-label={PAGINATION_COPY.pagesList} className="flex flex-col gap-1">
          {pages.map((page, index) => (
            <PageRow
              key={page.id}
              navId={node.id}
              page={page}
              position={index + 1}
              canRemove={canRemove}
              minimumNoteId={minimumNoteId}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </div>
        {!canRemove && (
          <p id={minimumNoteId} className={NOTE_CLASS_NAME}>
            {PAGINATION_COPY.minimumNote}
          </p>
        )}

        <button
          ref={addButtonRef}
          type="button"
          onClick={() => canAdd && addPage(node.id)}
          aria-disabled={canAdd ? undefined : true}
          aria-describedby={canAdd ? undefined : maximumNoteId}
          title={canAdd ? PAGINATION_COPY.addPageTitle : PAGINATION_COPY.maximumNote}
          className={ADD_BUTTON_CLASS_NAME}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {PAGINATION_COPY.addPage}
        </button>
        {!canAdd && (
          <p id={maximumNoteId} className={NOTE_CLASS_NAME}>
            {PAGINATION_COPY.maximumNote}
          </p>
        )}

        <div role="group" aria-labelledby={`${maximumNoteId}-controls`} className="mt-1 flex flex-col gap-1.5 border-t border-zinc-200 pt-2 dark:border-zinc-800">
          <p id={`${maximumNoteId}-controls`} className="px-0.5 text-[11px] font-medium text-fg-secondary">
            {PAGINATION_COPY.controlsTitle}
          </p>
          {CONTROL_ORDER.map((role) => {
            const visible = controls[role] !== undefined;
            const blocked = role === "ellipsis" && !visible && !canShowEllipsis;
            return (
              <div key={role} className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-xs text-fg-primary">{PAGINATION_CONTROL_LABELS[role]}</span>
                <InspectorBooleanToggle
                  checked={visible}
                  disabled={blocked}
                  onChange={(checked) => setControlVisible(node.id, role, checked)}
                  label={`Show ${PAGINATION_CONTROL_LABELS[role]}`}
                />
              </div>
            );
          })}
          <p className={NOTE_CLASS_NAME}>{PAGINATION_COPY.controlsNote}</p>
          <p className={NOTE_CLASS_NAME}>{PAGINATION_COPY.hideNote}</p>
          {!canShowEllipsis && controls.ellipsis === undefined && <p className={NOTE_CLASS_NAME}>{PAGINATION_COPY.ellipsisNeedsPages}</p>}
          {ellipsisIsMisleading(node, controls.ellipsis) && (
            <p id={ellipsisNoteId} className={NOTE_CLASS_NAME}>
              {PAGINATION_COPY.ellipsisConsecutive}
            </p>
          )}
        </div>
      </div>
    </InspectorSection>
  );
}
