"use client";

import { useContext, type CSSProperties } from "react";
import { RuntimeHiddenContext } from "@/features/canvas/components/document/previewRuntimeContext";
import { VideoEmbedPlaceholder } from "@/features/canvas/components/document/elements/VideoEmbedPlaceholder";
import { useHostOrigin } from "@/features/canvas/hooks/useHostOrigin";
import { useIsDesktopShell } from "@/features/canvas/hooks/useIsDesktopShell";
import { usePrefersReducedMotion } from "@/features/canvas/hooks/usePrefersReducedMotion";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { isNodeAuthoredHidden } from "@/features/editor/utils/isNodeAuthoredHidden";
import { resolveVideoEmbedPlayerConfig } from "@/lib/videoEmbed/videoEmbedPlayerConfig";

interface VideoEmbedFrameProps {
  node: EditorElementNode;
  isPreview: boolean;
  innerStyle: CSSProperties;
}

/**
 * What a Video Embed renders inside its layout box (BC-08.3):
 *
 * - Design: always the static VideoEmbedPlaceholder (approved decision 4):
 *   no provider iframe, image, script or request.
 * - Preview: the real provider player, configured by the shared
 *   resolveVideoEmbedPlayerConfig (the export uses the same function),
 *   mounted ONLY while the embed is shown — not hidden by an interaction
 *   on itself or any ancestor (RuntimeHiddenContext), and not hidden by
 *   authored Display none / Visibility hidden on itself or an ancestor.
 *   Leaving Preview, hiding it, or hiding an ancestor UNMOUNTS the iframe
 *   (approved decision 8), which ends the provider's document and so its
 *   playback and sound; showing it again mounts a fresh player that starts
 *   from its configured state (no position is kept). Changing project or
 *   unmounting the editor unmounts it the same way. Nothing is written to
 *   the document: no history, no unsaved change.
 * - No valid source, or before the host origin is known: the placeholder,
 *   never a fallback iframe.
 *
 * The iframe is keyed on its full configuration: a changed URL, sandbox or
 * permission always gets a fresh frame, since sandbox and allow apply only
 * on navigation.
 */
export function VideoEmbedFrame({ node, isPreview, innerStyle }: VideoEmbedFrameProps) {
  const runtimeHidden = useContext(RuntimeHiddenContext);
  const authoredHidden = useEditorStore((state) => (isPreview ? isNodeAuthoredHidden(state.document, node.id) === true : false));
  const hostOrigin = useHostOrigin();
  const reducedMotion = usePrefersReducedMotion();
  const isDesktop = useIsDesktopShell();

  const shown = isPreview && !runtimeHidden && !authoredHidden && hostOrigin !== null;
  const config = shown ? resolveVideoEmbedPlayerConfig(node, { hostOrigin, reducedMotion, fullscreenAllowed: !isDesktop }) : undefined;
  if (!config) return <VideoEmbedPlaceholder node={node} isPreview={isPreview} />;

  return (
    <iframe
      key={`${config.src}|${config.sandbox}|${config.allow ?? ""}`}
      data-video-embed-player={config.provider}
      src={config.src}
      title={config.title}
      sandbox={config.sandbox}
      allow={config.allow}
      referrerPolicy={config.referrerPolicy}
      loading={config.loading}
      id={node.htmlId}
      className={node.className}
      style={innerStyle}
    />
  );
}
