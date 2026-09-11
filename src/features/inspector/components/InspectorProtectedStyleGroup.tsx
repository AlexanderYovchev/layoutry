import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InspectorProtectedStyleGroupProps {
  /** True when this group's contents target a style-protected node/selection. */
  protected: boolean;
  children: ReactNode;
}

/**
 * Wraps ONE CSS section (or the free-child X/Y fields) so it stays fully
 * VISIBLE but interactively inert while protected (Checkpoint 1.15.3,
 * sections 24-25 — never hide a CSS section just because it's temporarily
 * locked, that would misleadingly read as "this element doesn't support
 * this"). This is an extra client-side defense layer on top of the real
 * enforcement (the store's guardedStyleMutation/guardedBulkStyleMutation)
 * — see this checkpoint's report, section 14, for why disabled controls
 * alone are never trusted as the actual guard.
 *
 * Uses the native `inert` attribute — the same mechanism InspectorSection
 * itself already relies on for a collapsed panel's own children — rather
 * than `pointer-events-none` alone. `pointer-events-none` only blocks
 * MOUSE interaction; it does nothing to stop a keyboard user from Tabbing
 * into a field underneath it and typing, whose value would then visibly
 * diverge from the (correctly unchanged) committed value once the guarded
 * commit is silently rejected — a real, keyboard-reachable gap found
 * while writing this checkpoint's own browser verification. `inert` closes
 * it at the browser level: focus, click, and text selection are all
 * refused for the whole subtree, and assistive tech skips it entirely.
 *
 * Used individually around each style-only section in InspectorNodeSummary/
 * InspectorMultiNodeSummary rather than one wrapper around the whole
 * Inspector, so the existing interleaved section order (Media, Video,
 * Link, ... between the style sections) never has to change and semantic
 * sections are never accidentally caught in the same wrapper.
 */
export function InspectorProtectedStyleGroup({ protected: isProtected, children }: InspectorProtectedStyleGroupProps) {
  if (!isProtected) return <>{children}</>;
  return (
    <div inert aria-disabled="true" className={cn("opacity-50")}>
      {children}
    </div>
  );
}
