"use client";

import { ChevronRight } from "lucide-react";
import { useId, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InspectorSectionProps {
  label: string;
  /** Small icon rendered before the label — purely decorative (aria-hidden), the label itself remains the accessible name. */
  icon?: ReactNode;
  /** Section-level controls (e.g. a "reset all" button) rendered at the header's trailing edge. Clicks inside never toggle the section. */
  actions?: ReactNode;
  /** Disables toggling and dims the header; children are not rendered. */
  disabled?: boolean;
  /**
   * Initial open state for the common, uncontrolled case — every section
   * keeps its own open/closed state internally, stable across re-renders
   * of the same component instance (e.g. a property update on the
   * selected element), so a section never unexpectedly collapses. Ignored
   * once `isOpen` is supplied (controlled mode).
   */
  defaultOpen?: boolean;
  /** Controlled mode override — when supplied, the section defers entirely to the caller for its open state (used by the Inspector's static demo content, which tracks open sections itself). */
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}

export function InspectorSection({
  label,
  icon,
  actions,
  disabled = false,
  defaultOpen = true,
  isOpen: controlledOpen,
  onToggle,
  children,
}: InspectorSectionProps) {
  const headerId = useId();
  const panelId = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  function handleToggle() {
    if (disabled) return;
    if (!isControlled) setInternalOpen((open) => !open);
    onToggle?.(!isOpen);
  }

  function stopActionsToggle(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      {/* h3: nested beneath the Inspector's own h2 title. */}
      <h3 className="flex items-center">
        <button
          id={headerId}
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={cn(
            "flex flex-1 items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 active:bg-zinc-200 disabled:pointer-events-none disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-300 dark:active:bg-zinc-800",
          )}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200 ease-out",
              isOpen && "rotate-90",
            )}
          />
          {icon && <span aria-hidden="true" className="shrink-0">{icon}</span>}
          <span className="truncate">{label}</span>
        </button>
        {actions && (
          <div onClick={stopActionsToggle} className="flex shrink-0 items-center gap-0.5 pr-2">
            {actions}
          </div>
        )}
      </h3>
      {!disabled && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              id={panelId}
              aria-labelledby={headerId}
              inert={!isOpen}
              className="flex flex-col gap-2 px-3 pb-3"
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
