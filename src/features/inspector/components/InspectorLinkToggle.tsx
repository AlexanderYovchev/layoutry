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
      className="rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
    >
      {linked ? "Linked" : "Unlinked"}
    </button>
  );
}
