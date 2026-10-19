"use client";

import {
  useEffect,
  useId,
  useRef,
  type PointerEvent,
  type ReactNode,
} from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { ResizeHandle } from "@/components/ui/resizable/ResizeHandle";

interface InspectorPanelProps {
  children: ReactNode;
  width: number;
  minWidth: number;
  maxWidth: number;
  isDragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  /** Collapsed to a narrow labeled rail (UI-1.6) — distinct from being hidden via the View menu, which unmounts the panel. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Animate the width change (only while a collapse/expand is in progress — never during a drag-resize). */
  animateWidth?: boolean;
}

export function InspectorPanel({
  children,
  width,
  minWidth,
  maxWidth,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  collapsed = false,
  onToggleCollapsed,
  animateWidth = false,
}: InspectorPanelProps) {
  const contentId = useId();
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  // Set only when the change came from one of this panel's own toggles, so
  // focus follows the user to the replacement toggle (the one they pressed
  // unmounts) without ever stealing focus on unrelated re-renders.
  const moveFocusAfterToggleRef = useRef(false);

  useEffect(() => {
    if (!moveFocusAfterToggleRef.current) return;
    moveFocusAfterToggleRef.current = false;
    (collapsed ? expandButtonRef : collapseButtonRef).current?.focus();
  }, [collapsed]);

  function toggle() {
    moveFocusAfterToggleRef.current = true;
    onToggleCollapsed?.();
  }

  return (
    // `width` includes the 8px outer gutter (pr-2), so the shell's width
    // budget (computeAppliedPanelWidths) is unchanged by the card layout.
    // overflow-hidden lives on the card, not the aside, so the resize
    // handle can sit in the gutter outside it.
    <aside
      aria-label="Inspector panel"
      data-collapsed={collapsed || undefined}
      style={{ width }}
      className={cn(
        "relative flex shrink-0 flex-col pr-2",
        animateWidth &&
          "ease-studio transition-[width] duration-(--ly-motion-slow)",
      )}
    >
      {/* Centered on the 8px gutter between the Workspace and this card (10px hit target, 1px line). Unavailable while collapsed: the rail has a fixed width. */}
      {!collapsed && (
        <ResizeHandle
          aria-label="Resize Inspector Panel"
          valueNow={width}
          valueMin={minWidth}
          valueMax={maxWidth}
          className="-left-2.25"
          isDragging={isDragging}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      )}
      <div className="rounded-surface border-line bg-surface-inspector shadow-panel relative flex min-h-0 flex-1 flex-col overflow-hidden border">
        {collapsed ? (
          // The whole rail is one large restore target, labeled visibly
          // (vertical "Inspector") and accessibly.
          <button
            ref={expandButtonRef}
            type="button"
            onClick={toggle}
            aria-label="Expand Inspector panel"
            aria-expanded={false}
            aria-controls={contentId}
            title="Expand Inspector panel"
            className="ease-studio text-fg-secondary hover:bg-surface-hover hover:text-fg-primary focus-visible:outline-accent active:bg-surface-selected flex flex-1 flex-col items-center gap-3 py-3 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <span className="rounded-control bg-surface-selected text-accent flex size-8 items-center justify-center">
              <PanelRightOpen aria-hidden="true" className="size-4" />
            </span>
            <span
              aria-hidden="true"
              className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl]"
            >
              Inspector
            </span>
          </button>
        ) : (
          <div className="absolute top-2 right-2 z-10">
            <Tooltip align="end" label="Collapse panel">
              <button
                ref={collapseButtonRef}
                type="button"
                onClick={toggle}
                aria-label="Collapse Inspector panel"
                aria-expanded
                aria-controls={contentId}
                className="rounded-control-sm ease-studio text-fg-muted hover:bg-surface-hover hover:text-fg-primary focus-visible:outline-accent active:bg-surface-selected flex size-8 items-center justify-center transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <PanelRightClose aria-hidden="true" className="size-4" />
              </button>
            </Tooltip>
          </div>
        )}

        {/*
         * Stays mounted while collapsed (display:none), so the selection's
         * Inspector state (open sections, unlinked edges, drafts) survives
         * a collapse; display:none also removes it from the tab order and
         * the accessibility tree.
         */}
        <div
          id={contentId}
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            collapsed && "hidden",
            // Fade the content in after an expand toggle only (not on page
            // load): it appears once the width transition is under way.
            !collapsed &&
              animateWidth &&
              "transition-opacity delay-100 duration-(--ly-motion-standard) starting:opacity-0",
          )}
        >
          {children}
        </div>
      </div>
    </aside>
  );
}
