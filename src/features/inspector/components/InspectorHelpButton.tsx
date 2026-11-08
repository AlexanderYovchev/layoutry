"use client";

import { HelpCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "@/components/ui/Tooltip";

interface InspectorHelpButtonProps {
  /** The help text: the button's accessible name and the tooltip's content. */
  help: string;
  /** The id of a hidden copy of the help text, so a control can reference it with aria-describedby. */
  descriptionId?: string;
}

/** Space kept between a shifted tooltip and the edge it would cross. */
const EDGE_MARGIN = 4;

/** The visible horizontal extent of the nearest scrolling ancestor (excluding its scrollbar), or the window. */
function horizontalBounds(element: HTMLElement): {
  left: number;
  right: number;
} {
  for (
    let ancestor = element.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    const overflowY = getComputedStyle(ancestor).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      const left = ancestor.getBoundingClientRect().left + ancestor.clientLeft;
      return { left, right: left + ancestor.clientWidth };
    }
  }
  return { left: 0, right: document.documentElement.clientWidth };
}

/**
 * The Inspector's small "?" help icon (Checkpoint 4.1's InspectorPropertyRow
 * help, extracted in BC-04.2). The help text is the button's accessible
 * name, and the tooltip shows on hover and on keyboard focus, so it is
 * never hover-only.
 *
 * Escape hides the tooltip while it is showing (WCAG 1.4.13), without
 * moving focus. That Escape is consumed (preventDefault), unless focus is
 * in a text field (whose own Escape must still run), so the editor's
 * own Escape (clear the selection, which would empty the Inspector) doesn't
 * also run; a second Escape behaves as usual. The tooltip shows again once
 * the pointer and focus have both left the icon.
 *
 * The tooltip (192 px at most) is wider than the room beside an icon at
 * the Inspector's narrowest widths, so when it appears it is measured and
 * shifted sideways to stay inside the Inspector's scrolling area instead
 * of running past the panel or window edge.
 */
export function InspectorHelpButton({
  help,
  descriptionId,
}: InspectorHelpButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const showing = (hovered || focused) && !dismissed;

  if (dismissed && !hovered && !focused) setDismissed(false);

  useEffect(() => {
    if (!showing) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setDismissed(true);
      // Hovered while typing in a field: the field's own Escape (restore
      // the value) still runs, so the event is left alone.
      const target = event.target;
      const inField =
        target instanceof HTMLElement &&
        (target.matches("input, select, textarea") || target.isContentEditable);
      if (!inField) event.preventDefault();
    }
    // Capture phase: runs before the editor's window-level Escape handler.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [showing]);

  function keepInside() {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const bounds = horizontalBounds(tooltip);
    const rect = tooltip.getBoundingClientRect();
    const naturalLeft = rect.left - offsetX;
    const naturalRight = rect.right - offsetX;
    let next = 0;
    if (naturalRight > bounds.right - EDGE_MARGIN)
      next = bounds.right - EDGE_MARGIN - naturalRight;
    if (naturalLeft + next < bounds.left + EDGE_MARGIN)
      next = bounds.left + EDGE_MARGIN - naturalLeft;
    setOffsetX(Math.round(next));
  }

  return (
    <Tooltip
      label={help}
      suppressed={dismissed}
      offsetX={offsetX}
      tooltipRef={tooltipRef}
    >
      <button
        type="button"
        data-inspector-help=""
        aria-label={help}
        onPointerEnter={() => {
          keepInside();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => {
          keepInside();
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        className="text-fg-muted hover:text-fg-secondary focus-visible:outline-accent rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2"
      >
        <HelpCircle aria-hidden="true" className="size-3" />
      </button>
      {/* Referenced content is read even when hidden; a button's aria-label is not reliably used as a description. */}
      {descriptionId && (
        <span id={descriptionId} hidden>
          {help}
        </span>
      )}
    </Tooltip>
  );
}
