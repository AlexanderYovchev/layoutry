"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { formatGradientStopsCss, type GradientColorStop } from "@/features/editor/types/gradient";
import { cn } from "@/lib/utils";

interface InspectorGradientStopTrackProps {
  stops: GradientColorStop[];
  selectedStopId: string | null;
  disabled?: boolean;
  onSelectStop: (stopId: string) => void;
  /** Fires once, at the start of a pointer gesture (before any movement is known) — the caller opens its transaction here. */
  onDragStart: () => void;
  /** Fires on every pointer move during a drag with the new clamped 0-100 position — the caller writes this live (no history). */
  onDragMove: (stopId: string, position: number) => void;
  /** Fires once when the gesture ends — `moved` is false for a plain click (select-only, nothing to commit) and true after any real drag. */
  onDragEnd: (moved: boolean) => void;
  /**
   * BC-17.3.1: fires instead of onDragEnd when a drag is abandoned — Escape,
   * a cancelled pointer, or the track unmounting mid-drag. The caller rolls
   * the live value back and closes its transaction; no history entry.
   */
  onDragCancel: () => void;
  /** One discrete keyboard adjustment (Arrow/Shift+Arrow/Home/End) — one call is one commit, no transaction involved. */
  onAdjustPosition: (stopId: string, nextPosition: number) => void;
}

function stopAccessibleName(stop: GradientColorStop): string {
  return `Gradient stop: ${stop.color} at ${stop.position}%`;
}

/**
 * The interactive 0-100% stop track (Checkpoint 4.3.1's #6) — always a
 * flat left-to-right strip (formatGradientStopsCss), deliberately NOT
 * the true rendered gradient (formatGradientCss, used by the accurate
 * preview next to this) since a Radial gradient's real 2D appearance has
 * no honest "stretched flat" representation; stop position is identical
 * for both gradient types, so this can stay type-agnostic.
 *
 * Keyboard pattern (documented once, per this checkpoint's own explicit
 * "avoid conflicting patterns" instruction): Tab/Shift+Tab moves between
 * markers in normal DOM order; Arrow Left/Right/Home/End, while a marker
 * has focus, ADJUST that marker's own position rather than navigating to
 * a sibling — there is no separate "navigate" mode, since with at most
 * MAX_GRADIENT_STOPS markers, plain Tab order is already sufficient to
 * reach any of them.
 */
export function InspectorGradientStopTrack({
  stops,
  selectedStopId,
  disabled = false,
  onSelectStop,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onAdjustPosition,
}: InspectorGradientStopTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ stopId: string; moved: boolean } | null>(null);
  const escapeListenerRef = useRef<((event: globalThis.KeyboardEvent) => void) | null>(null);
  const onDragCancelRef = useRef(onDragCancel);
  useEffect(() => {
    onDragCancelRef.current = onDragCancel;
  });

  function stopListening() {
    if (escapeListenerRef.current) window.removeEventListener("keydown", escapeListenerRef.current, true);
    escapeListenerRef.current = null;
  }

  /** Abandons the drag in progress, if any: no commit, the caller restores the value. */
  function cancelDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = null;
    stopListening();
    onDragCancelRef.current();
  }

  // A drag never outlives the track (e.g. the selection changes mid-drag): it is abandoned, never left open.
  useEffect(
    () => () => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      if (escapeListenerRef.current) window.removeEventListener("keydown", escapeListenerRef.current, true);
      onDragCancelRef.current();
    },
    [],
  );

  function positionFromClientX(clientX: number): number {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return 0;
    const clamped = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return Math.round((clamped / rect.width) * 100);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, stopId: string) {
    if (disabled) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelectStop(stopId);
    draggingRef.current = { stopId, moved: false };
    // Escape abandons the drag, and only that: captured before any editor shortcut sees it.
    stopListening();
    const listener = (keyEvent: globalThis.KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      cancelDrag();
    };
    escapeListenerRef.current = listener;
    window.addEventListener("keydown", listener, true);
    onDragStart();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>, stopId: string) {
    const dragging = draggingRef.current;
    if (!dragging || dragging.stopId !== stopId) return;
    dragging.moved = true;
    onDragMove(stopId, positionFromClientX(event.clientX));
  }

  function handlePointerUp() {
    const dragging = draggingRef.current;
    // Already abandoned (Escape): the release after it does nothing.
    if (!dragging) return;
    draggingRef.current = null;
    stopListening();
    onDragEnd(dragging.moved);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, stop: GradientColorStop) {
    let delta = 0;
    if (event.key === "ArrowLeft") delta = event.shiftKey ? -10 : -1;
    else if (event.key === "ArrowRight") delta = event.shiftKey ? 10 : 1;
    else if (event.key === "Home") {
      event.preventDefault();
      onAdjustPosition(stop.id, 0);
      return;
    } else if (event.key === "End") {
      event.preventDefault();
      onAdjustPosition(stop.id, 100);
      return;
    } else {
      return;
    }
    event.preventDefault();
    onAdjustPosition(stop.id, Math.min(100, Math.max(0, stop.position + delta)));
  }

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label="Gradient stops"
      className="relative h-6 w-full shrink-0 rounded-md border border-zinc-200 dark:border-zinc-800"
      style={{ backgroundImage: formatGradientStopsCss(stops) }}
    >
      {stops.map((stop) => {
        const isSelected = stop.id === selectedStopId;
        return (
          <button
            key={stop.id}
            type="button"
            disabled={disabled}
            aria-label={stopAccessibleName(stop)}
            aria-pressed={isSelected}
            title={stopAccessibleName(stop)}
            style={{ left: `${stop.position}%` }}
            onPointerDown={(event) => handlePointerDown(event, stop.id)}
            onPointerMove={(event) => handlePointerMove(event, stop.id)}
            onPointerUp={handlePointerUp}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            onKeyDown={(event) => handleKeyDown(event, stop)}
            className={cn(
              "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 bg-white shadow-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40 dark:bg-zinc-950",
              isSelected ? "z-10 border-blue-500" : "border-zinc-500 dark:border-zinc-400",
            )}
          />
        );
      })}
    </div>
  );
}
