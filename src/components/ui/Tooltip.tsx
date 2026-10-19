import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  label: string;
  children: ReactNode;
  /**
   * Which trigger edge the tooltip anchors to. "start" (default) grows
   * rightward; "end" grows leftward, for triggers near a container's
   * right edge (e.g. the header's trailing actions) that would
   * otherwise push the tooltip past it.
   */
  align?: "start" | "end";
}

export function Tooltip({ label, children, align = "start" }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      {/*
       * Purely a visual hint for sighted pointer/keyboard-focus users —
       * every trigger this wraps already carries its own accessible name
       * (an aria-label or sr-only text), so this is redundant for
       * assistive tech rather than load-bearing. aria-hidden (not
       * role="tooltip", which isn't wired up via aria-describedby and
       * would otherwise violate parent roles like tablist/toolbar that
       * only permit specific child roles) keeps it out of the
       * accessibility tree entirely.
       */}
      <span
        aria-hidden="true"
        // w-max + max-w-48 (not whitespace-nowrap): a short label keeps its
        // natural single-line width, but a longer one (e.g. an Inspector
        // property's plain-language help text) wraps at 192px instead of
        // rendering as one long unbreakable line. Anchored to the trigger's
        // left edge (not centered) so it only ever grows rightward — a
        // centered tooltip under a trigger sitting near a narrow panel's
        // left edge would still overflow the panel's own scrollable
        // container on its left side and get clipped there.
        className={cn(
          "pointer-events-none absolute top-full z-50 mt-1.5 w-max max-w-48 rounded-md bg-zinc-900 px-2 py-1 text-xs text-white opacity-0 shadow-sm transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900",
          align === "start" ? "left-0" : "right-0",
        )}
      >
        {label}
      </span>
    </span>
  );
}
