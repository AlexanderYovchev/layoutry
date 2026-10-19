"use client";

import { ChevronDown } from "lucide-react";
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
    <div className="border-b border-line-subtle">
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
            "group/section flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-fg-primary transition-colors duration-150 ease-studio hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent active:bg-surface-selected disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {/* Fixed at size-4 regardless of what the caller passes, so every future section (Typography, Border, ...) gets the same identity-icon weight as InspectorElementSummary's icon without each one remembering to size it. */}
          {icon && (
            <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center text-fg-secondary [&>svg]:size-4">
              {icon}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {/* Trailing chevron (reference layout): points down when open, right when collapsed. */}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-fg-muted transition-[transform,color] duration-200 ease-studio group-hover/section:text-fg-secondary",
              !isOpen && "-rotate-90",
            )}
          />
        </button>
        {actions && (
          <div onClick={stopActionsToggle} className="flex shrink-0 items-center gap-1 pr-2">
            {actions}
          </div>
        )}
      </h3>
      {!disabled && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-studio",
            isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              id={panelId}
              aria-labelledby={headerId}
              inert={!isOpen}
              className="flex flex-col gap-2.5 px-3 pt-0.5 pb-3.5"
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
