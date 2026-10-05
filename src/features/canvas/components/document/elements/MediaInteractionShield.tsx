"use client";

import { useEditorStore } from "@/features/editor/stores/useEditorStore";

/**
 * An editor-only pointer shield for embedded/native-interactive media
 * (Checkpoint 1.15) — sits directly above the real `<video>`/`<iframe>`/
 * `<audio>` as a plain absolutely-positioned sibling, so neither
 * element's own native interaction (playback controls; an iframe's
 * entirely separate embedded document) can ever receive a pointer event
 * during DESIGN mode. It captures the event instead (a plain `<div>`
 * already has `pointer-events: auto` — nothing needs to be set
 * explicitly) and, critically, never calls stopPropagation or attaches
 * any handler of its own: the click still bubbles up through the wrapper
 * exactly like a click on any other inert child (the inner `<img>` in
 * ImageElement, for example) already does, reaching
 * CanvasInteractionBoundary's own window listener for ordinary selection
 * — see LinkElement's preventEditorNavigation doc comment for the
 * identical bubbling guarantee applied to a different native default
 * action. Drag originates from the wrapper's own `listeners` (dnd-kit's
 * pointerdown handler), which this shield's pointerdown naturally bubbles
 * into for the same reason — no forwarding code is needed here at all.
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
 *
 * Renders nothing at all in PREVIEW mode (Checkpoint 1.15.6.12.3) — a
 * real, pre-existing gap this checkpoint's own Audio brief asked to be
 * investigated, not assumed: Preview Mode (Checkpoint 1.15.6.8) was built
 * well after Video/Iframe (Checkpoint 1.15, which predates Preview Mode
 * entirely — see this component's own original doc comment, still true
 * at the time), and nothing ever revisited this shield once Preview
 * existed. Live Chromium verification this checkpoint (document.
 * elementFromPoint at a rendered Video's own center, in Preview) proved
 * the shield was still unconditionally intercepting every click there —
 * the native player's own controls were genuinely unreachable in Preview,
 * not just in Design, for as long as Video/Iframe have existed. That is a
 * real, shared, generically-fixable bug (every consumer of this one
 * component gets the same fix at once, regression-tested per consumer),
 * not a new feature — exactly the class of pre-existing issue this
 * checkpoint's brief explicitly permitted fixing rather than silently
 * reproducing for Audio. Design's own protection is completely
 * unaffected: this still renders unconditionally while `editorMode` is
 * "design", with the exact same bubbling guarantees described above.
 */
export function MediaInteractionShield() {
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  if (isPreview) return null;
  return <div aria-hidden="true" className="absolute inset-0" />;
}
