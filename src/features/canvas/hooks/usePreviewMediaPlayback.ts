"use client";

import { useEffect, type RefObject } from "react";

interface PreviewMediaPlaybackOptions {
  isPreview: boolean;
  /** The effective autoplay (getEffectiveAutoplay): authored autoplay AND muted. */
  autoplay: boolean;
  /** The element, or an ancestor, is hidden by a Preview interaction (RuntimeHiddenContext). */
  hidden?: boolean;
}

/**
 * Editor-only playback lifecycle for a Canvas `<video>`/`<audio>`
 * (BC-02.2). The Canvas renders ONE native media element for both Design
 * and Preview — entering Preview only flips its `autoplay` attribute — so
 * two native behaviors never happen on their own:
 *
 * - B2: Chromium (and Electron) only honor `autoplay` while the element is
 *   first loading. An element that already loaded in Design ignores the
 *   attribute when it is added later, so entering Preview never started
 *   muted autoplay. Entering Preview therefore calls `play()` once for
 *   autoplay-enabled media. React has already committed `muted` as a
 *   property by the time this effect runs, so a muted video is muted
 *   before the attempt; this never unmutes anything. A rejected promise
 *   (browser autoplay policy, or a pause interrupting the play) is
 *   swallowed: the user can still start it from the native controls.
 *   Muted-only (BC-02.2.1): the caller passes the effective autoplay, and
 *   the element must also still be muted when Preview starts, so media
 *   the user unmuted from the controls in an earlier session does not
 *   start with sound. Unmuted media is never started automatically.
 *
 * - B3: nothing paused media when Preview ended, and Design's
 *   MediaInteractionShield then blocked the controls that could stop it.
 *   The effect cleanup pauses the element whenever Preview ends (exit,
 *   project open/new, which reset `editorMode`), and on unmount. It does
 *   not rewind, and never writes playback state to the document.
 *
 * - Hidden by an interaction (BC-02.5.1): the element stays mounted, so the
 *   cleanup pauses it and keeps its position. While hidden nothing starts
 *   it. When shown again, muted autoplay resumes from that position, as on
 *   the exported page; anything else stays paused.
 *
 * Runs only when `isPreview`/`autoplay`/`hidden` change, not on unrelated
 * renders, and attaches no event listeners.
 */
export function usePreviewMediaPlayback(mediaRef: RefObject<HTMLMediaElement | null>, { isPreview, autoplay, hidden = false }: PreviewMediaPlaybackOptions) {
  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !isPreview || hidden) return;
    if (autoplay && media.muted) {
      void Promise.resolve(media.play()).catch(() => {});
    }
    return () => {
      media.pause();
    };
  }, [mediaRef, isPreview, autoplay, hidden]);
}
