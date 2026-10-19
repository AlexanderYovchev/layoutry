"use client";

interface InspectorLinkToggleProps {
  linked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * Shared linked/unlinked affordance for grouped edge/axis properties —
 * margin, padding, and gap today (Checkpoint 4.1 extracted this from the
 * identical button each of those hand-rolled independently), and the
 * intended home for border-width/border-radius/shadow-axis groups later.
 * Same markup and text ("Linked"/"Unlinked") as the original hand-rolled
 * buttons, so existing accessible-name-based tests are unaffected.
 */
export function InspectorLinkToggle({ linked, onToggle, disabled = false }: InspectorLinkToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={linked}
      className="flex h-6 shrink-0 items-center justify-center rounded-control-sm px-1.5 text-[11px] font-medium text-fg-secondary transition-colors duration-150 ease-studio hover:bg-surface-hover hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40"
    >
      {linked ? "Linked" : "Unlinked"}
    </button>
  );
}
