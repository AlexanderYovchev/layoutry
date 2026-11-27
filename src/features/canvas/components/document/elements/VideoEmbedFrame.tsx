"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { VideoEmbedPlaceholder } from "@/features/canvas/components/document/elements/VideoEmbedPlaceholder";
import { useFullscreenElement } from "@/features/canvas/hooks/useFullscreenElement";
import { useHostOrigin } from "@/features/canvas/hooks/useHostOrigin";
import { usePrefersReducedMotion } from "@/features/canvas/hooks/usePrefersReducedMotion";
import { usePreviewFrameShown } from "@/features/canvas/hooks/usePreviewFrameShown";
import { createVideoEmbedFrameToken, getDesktopVideoEmbedFrames } from "@/features/canvas/utils/desktopVideoEmbedFrames";
import type { EditorElementNode } from "@/features/editor/types/document";
import { resolveVideoEmbedPlayerConfig, type VideoEmbedPlayerConfig } from "@/lib/videoEmbed/videoEmbedPlayerConfig";

interface VideoEmbedFrameProps {
  node: EditorElementNode;
  isPreview: boolean;
  innerClassName: string;
}

/**
 * What a Video Embed renders inside its layout box (BC-08.3):
 *
 * - Design: always the static VideoEmbedPlaceholder (approved decision 4):
 *   no provider iframe, image, script or request.
 * - Preview: the real provider player, configured by the shared
 *   resolveVideoEmbedPlayerConfig (the export uses the same function),
 *   mounted ONLY while the embed is shown (usePreviewFrameShown, the
 *   lifecycle rule generic Embeds share since BC-08.3.1).
 *   Leaving Preview, hiding it, or hiding an ancestor UNMOUNTS the iframe
 *   (approved decision 8), which ends the provider's document and so its
 *   playback and sound; showing it again mounts a fresh player that starts
 *   from its configured state (no position is kept). Changing project or
 *   unmounting the editor unmounts it the same way. Nothing is written to
 *   the document: no history, no unsaved change.
 * - No valid source, or before the host origin is known: the placeholder,
 *   never a fallback iframe.
 *
 * The player is keyed on its full configuration: a changed URL, sandbox or
 * permission always gets a fresh frame (and, in the desktop app, a fresh
 * authorization), since sandbox and allow apply only on navigation.
 *
 * Fullscreen release (BC-08.4): a player that is the fullscreen element when
 * it should go away (hidden, ancestor hidden, Preview exit) is kept mounted
 * for that moment, asked to leave fullscreen, and removed as soon as the
 * document reports fullscreen ended. Removing a fullscreen iframe abruptly
 * left Chromium's fullscreen state stale in the desktop app (the window
 * stayed fullscreen, or the next fullscreen request never completed). While
 * releasing, the player is inside its hidden (or Design) wrapper.
 */
export function VideoEmbedFrame({ node, isPreview, innerClassName }: VideoEmbedFrameProps) {
  const previewShown = usePreviewFrameShown(node.id, isPreview);
  const hostOrigin = useHostOrigin();
  const reducedMotion = usePrefersReducedMotion();

  const fullscreenElement = useFullscreenElement();
  const playerIsFullscreen = fullscreenElement instanceof HTMLIFrameElement && fullscreenElement.hasAttribute("data-video-embed-player") && fullscreenElement.parentElement?.getAttribute("data-node-id") === node.id;
  const releasing = !previewShown && playerIsFullscreen;
  useEffect(() => {
    if (releasing) void document.exitFullscreen().catch(() => {});
  }, [releasing]);

  const shown = (previewShown || releasing) && hostOrigin !== null;
  // BC-08.4: fullscreen is delegated everywhere; in the desktop app the
  // main process still grants it only to the authorized player frame.
  const config = shown ? resolveVideoEmbedPlayerConfig(node, { hostOrigin, reducedMotion, fullscreenAllowed: true }) : undefined;
  if (!config) return <VideoEmbedPlaceholder node={node} isPreview={isPreview} />;

  return <VideoEmbedPlayerFrame key={`${config.src}|${config.sandbox}|${config.allow ?? ""}`} config={config} node={node} innerClassName={innerClassName} />;
}

interface VideoEmbedPlayerFrameProps {
  config: VideoEmbedPlayerConfig;
  node: EditorElementNode;
  innerClassName: string;
}

/**
 * One mounted player iframe. In the desktop app (BC-08.4) it gets a fresh
 * random frame name and is registered with the main process BEFORE it is
 * given its src — so its very first request is already recognisable as an
 * authorized player — and unregistered when it unmounts, which is exactly
 * when the player goes away. A registration that fails leaves the frame
 * without a source (fail closed). In a browser nothing is registered and
 * the frame has no name.
 *
 * Leaving fullscreen with the player (BC-08.4): if this player is the
 * fullscreen element when it unmounts (Preview exit, hidden, ancestor
 * hidden, project change), it leaves fullscreen first, while still in the
 * document. Relying on the browser to notice the removal left the desktop
 * window stuck in fullscreen intermittently.
 */
function VideoEmbedPlayerFrame({ config, node, innerClassName }: VideoEmbedPlayerFrameProps) {
  const [desktop] = useState(getDesktopVideoEmbedFrames);
  const [token] = useState(() => (desktop ? createVideoEmbedFrameToken() : undefined));
  const [registered, setRegistered] = useState(false);
  const provider = config.provider;

  useEffect(() => {
    if (!desktop || !token) return;
    let active = true;
    desktop.register(token, provider).then(
      () => {
        if (active) setRegistered(true);
      },
      () => {},
    );
    return () => {
      active = false;
      void desktop.unregister(token).catch(() => {});
    };
  }, [desktop, token, provider]);

  const frameRef = useRef<HTMLIFrameElement>(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    return () => {
      if (frame && frame.ownerDocument.fullscreenElement === frame) void frame.ownerDocument.exitFullscreen().catch(() => {});
    };
  }, []);

  const ready = !desktop || registered;
  return (
    <iframe
      ref={frameRef}
      data-video-embed-player={config.provider}
      name={token}
      src={ready ? config.src : undefined}
      title={config.title}
      sandbox={config.sandbox}
      allow={config.allow}
      referrerPolicy={config.referrerPolicy}
      loading={config.loading}
      id={node.htmlId}
      className={innerClassName}
    />
  );
}
