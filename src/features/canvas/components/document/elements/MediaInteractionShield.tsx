"use client";

/**
 * An editor-only pointer shield for embedded/native-interactive media
 * (Checkpoint 1.15) — sits directly above the real `<video>`/`<iframe>`
 * as a plain absolutely-positioned sibling, so neither element's own
 * native interaction (video playback controls; an iframe's entirely
 * separate embedded document) can ever receive a pointer event during
 * design mode. It captures the event instead (a plain `<div>` already has
 * `pointer-events: auto` — nothing needs to be set explicitly) and,
 * critically, never calls stopPropagation or attaches any handler of its
 * own: the click still bubbles up through the wrapper exactly like a
 * click on any other inert child (the inner `<img>` in ImageElement, for
 * example) already does, reaching CanvasInteractionBoundary's own window
 * listener for ordinary selection — see LinkElement's
 * preventEditorNavigation doc comment for the identical bubbling
 * guarantee applied to a different native default action. Drag
 * originates from the wrapper's own `listeners` (dnd-kit's pointerdown
 * handler), which this shield's pointerdown naturally bubbles into for
 * the same reason — no forwarding code is needed here at all.
 *
 * Deliberately a shared component (Video needed one for playback safety —
 * see this checkpoint's own report, section G — and Iframe needed one for
 * an even stronger reason: an embedded page's own document does not
 * bubble its internal clicks into the PARENT document's event listeners
 * at all, so without a shield in the parent document, Canvas selection
 * would be unreachable the instant the pointer entered the iframe's
 * rendered content — see section H). Purely presentational: never reaches
 * the document model, never affects layout (position: absolute; inset: 0
 * relative to its own already-correctly-sized parent, no measurement
 * needed unlike FormGuideOverlay/MediaGuideOverlay), and is invisible to
 * the Export feature by construction (Export walks the typed document
 * model, never this render tree).
 */
export function MediaInteractionShield() {
  return <div aria-hidden="true" className="absolute inset-0" />;
}
