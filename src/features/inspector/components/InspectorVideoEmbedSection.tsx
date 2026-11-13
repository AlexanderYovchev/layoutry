"use client";

import { useState } from "react";
import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { InspectorMediaTextField } from "@/features/inspector/components/InspectorMediaTextField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { commitVideoEmbedUrl } from "@/features/inspector/utils/commitVideoEmbedUrl";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { readVideoEmbedSource, withVideoEmbedPrivacy, withVideoEmbedStart } from "@/lib/videoEmbed/buildVideoEmbedUrl";
import { formatStartTime, parseStartTimeInput } from "@/lib/videoEmbed/videoEmbedTime";
import { getVideoEmbedProvider, type VideoEmbedCapability, type VideoEmbedProvider } from "@/lib/videoEmbed/videoEmbedProviders";

interface InspectorVideoEmbedSectionProps {
  /** The selected node — rendered only for a Video Embed (see InspectorNodeSummary / isVideoEmbedNode). */
  node: EditorElementNode;
}

const PRIVACY_DESCRIPTIONS: Partial<Record<VideoEmbedProvider["id"], string>> = {
  youtube: "Uses youtube-nocookie.com. It reduces tracking until the video is played; it doesn't remove it.",
  vimeo: "Asks Vimeo not to track viewing sessions. Some essential cookies remain.",
  wistia: "Asks Wistia not to track viewing sessions.",
};

const UNVERIFIED_NOTE = "Not yet confirmed with this provider's player.";

function Note({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} className="px-0.5 text-[11px] text-fg-secondary">
      {children}
    </p>
  );
}

/**
 * The Video Embed Inspector (BC-08.2). One Video URL field detects the
 * provider; everything shown below it is what that provider can actually
 * do (VIDEO_EMBED_PROVIDERS' capability matrix). An unsupported setting
 * is not shown as a control: one line says why instead. Its stored value
 * is kept, so switching back to a provider that supports it restores it.
 *
 * - Video URL (approved decision 13): an invalid link shows an error and
 *   keeps the draft; the stored source, history and saved state are not
 *   touched (commitVideoEmbedUrl). A valid one is stored in canonical
 *   form, so the field then shows the normalized embed link.
 * - Playback toggles use the generic one-shot setters (one Undo step
 *   each). Autoplay and Muted stay independent: Muted is never switched
 *   on for the user; the text says autoplay only starts when muted
 *   (BC-02.2.1 muted-only autoplay).
 * - Start time and privacy mode live in the source, so they are one
 *   setElementSrc each (one Undo step).
 * Width, height, aspect ratio, spacing, border, radius, background,
 * visibility and position stay in the existing CSS sections.
 */
export function InspectorVideoEmbedSection({ node }: InspectorVideoEmbedSectionProps) {
  const setElementSrc = useEditorStore((state) => state.setElementSrc);
  const setElementTitle = useEditorStore((state) => state.setElementTitle);
  const setElementControls = useEditorStore((state) => state.setElementControls);
  const setElementAutoplay = useEditorStore((state) => state.setElementAutoplay);
  const setElementMuted = useEditorStore((state) => state.setElementMuted);
  const setElementLoop = useEditorStore((state) => state.setElementLoop);

  const [urlError, setUrlError] = useState<string | undefined>(undefined);
  const [startError, setStartError] = useState<string | undefined>(undefined);
  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setUrlError(undefined);
    setStartError(undefined);
  }

  const source = readVideoEmbedSource(node.src);
  const provider = source ? getVideoEmbedProvider(source.provider) : undefined;
  const supports = (capability: VideoEmbedCapability) => provider !== undefined && provider.capabilities[capability] !== "unsupported";
  const unverified = (capability: VideoEmbedCapability) => provider?.capabilities[capability] === "unverified";

  function handleUrlCommit(value: string) {
    const result = commitVideoEmbedUrl(node.id, value);
    setUrlError(result.ok ? undefined : result.message);
    if (result.ok) setStartError(undefined);
  }

  function handleStartCommit(value: string) {
    if (!node.src) return;
    const seconds = parseStartTimeInput(value);
    if (seconds === undefined) {
      setStartError("Enter a time like 1:30 or 90.");
      return;
    }
    setStartError(undefined);
    const next = withVideoEmbedStart(node.src, seconds);
    if (next !== undefined) setElementSrc(node.id, next);
  }

  function unsupported(capability: VideoEmbedCapability) {
    const note = provider?.unsupportedNotes[capability];
    return note ? <Note key={capability}>{note}</Note> : null;
  }

  return (
    <InspectorSection label="Video" defaultOpen>
      <InspectorMediaTextField
        id="video-embed-url"
        label="Video URL"
        value={node.src ?? ""}
        hasExplicitValue={node.src !== undefined}
        placeholder="https://www.youtube.com/watch?v=…"
        description={provider ? undefined : "YouTube, Vimeo, Loom or Wistia link"}
        onCommit={handleUrlCommit}
        onReset={() => {
          setUrlError(undefined);
          setStartError(undefined);
          setElementSrc(node.id, undefined);
        }}
        error={urlError}
      />
      <InspectorPropertyRow label="Provider">
        <span data-testid="video-embed-provider" className="truncate text-xs text-fg-secondary">
          {provider ? provider.displayName : "None yet"}
        </span>
      </InspectorPropertyRow>
      {provider?.playback.status === "blocked" && (
        <p data-testid="video-embed-playback-blocked" role="status" className="px-0.5 text-[11px] text-red-600 dark:text-red-400">
          {provider.playback.reason}
        </p>
      )}
      {provider?.playback.status === "unverified" && <Note>{provider.playback.note}</Note>}

      {provider && source && (
        <>
          {supports("muted") ? (
            <InspectorPropertyRow label="Muted">
              <InspectorBooleanToggle checked={node.muted ?? false} onChange={(checked) => setElementMuted(node.id, checked)} label="Muted" />
            </InspectorPropertyRow>
          ) : (
            unsupported("muted")
          )}
          {unverified("muted") && <Note>{UNVERIFIED_NOTE}</Note>}
          {supports("autoplay") ? (
            <>
              <InspectorPropertyRow label="Autoplay">
                <InspectorBooleanToggle checked={node.autoplay ?? false} onChange={(checked) => setElementAutoplay(node.id, checked)} label="Autoplay" />
              </InspectorPropertyRow>
              <Note>
                {node.autoplay === true && node.muted !== true
                  ? "Autoplay won't start until Muted is on. Layoutry only autoplays muted videos."
                  : "Starts by itself only when Muted is also on, and never for visitors who ask for reduced motion. Browsers and the provider can still block it."}
              </Note>
            </>
          ) : (
            unsupported("autoplay")
          )}
          {supports("loop") ? (
            <InspectorPropertyRow label="Loop">
              <InspectorBooleanToggle checked={node.loop ?? false} onChange={(checked) => setElementLoop(node.id, checked)} label="Loop" />
            </InspectorPropertyRow>
          ) : (
            unsupported("loop")
          )}
          {supports("controls") ? (
            <InspectorPropertyRow label="Controls">
              <InspectorBooleanToggle checked={node.controls !== false} onChange={(checked) => setElementControls(node.id, checked)} label="Controls" />
            </InspectorPropertyRow>
          ) : (
            unsupported("controls")
          )}
          {supports("startTime") ? (
            <InspectorMediaTextField
              id="video-embed-start"
              label="Start at"
              value={source.startSeconds !== undefined ? formatStartTime(source.startSeconds) : ""}
              hasExplicitValue={source.startSeconds !== undefined}
              placeholder="0:00"
              onCommit={handleStartCommit}
              onReset={() => {
                setStartError(undefined);
                const next = node.src ? withVideoEmbedStart(node.src, undefined) : undefined;
                if (next !== undefined) setElementSrc(node.id, next);
              }}
              error={startError}
            />
          ) : (
            unsupported("startTime")
          )}
          {supports("privacyMode") ? (
            <>
              <InspectorPropertyRow label="Privacy mode">
                <InspectorBooleanToggle
                  checked={source.privacy}
                  onChange={(checked) => {
                    const next = node.src ? withVideoEmbedPrivacy(node.src, checked) : undefined;
                    if (next !== undefined) setElementSrc(node.id, next);
                  }}
                  label="Privacy mode"
                />
              </InspectorPropertyRow>
              {PRIVACY_DESCRIPTIONS[provider.id] && <Note>{PRIVACY_DESCRIPTIONS[provider.id] ?? ""}</Note>}
              {unverified("privacyMode") && <Note>{UNVERIFIED_NOTE}</Note>}
            </>
          ) : (
            unsupported("privacyMode")
          )}
        </>
      )}

      <InspectorMediaTextField
        id="video-embed-title"
        label="Title"
        value={node.title ?? ""}
        hasExplicitValue={node.title !== undefined}
        placeholder="Embedded video"
        description="Screen readers announce this name for the video."
        onCommit={(value) => setElementTitle(node.id, value)}
        onReset={() => setElementTitle(node.id, undefined)}
      />
      {provider && (
        <div data-testid="video-embed-limitations" className="flex flex-col gap-1">
          {provider.limitations.map((limitation) => (
            <Note key={limitation}>{limitation}</Note>
          ))}
          <Note>{`The video plays in Preview and on exported pages; the canvas shows a placeholder and loads nothing from ${provider.displayName} while you design.`}</Note>
          <Note>{`It plays from ${provider.displayName}'s site, so it needs an internet connection.`}</Note>
          {provider.capabilities.fullscreen !== "unsupported" && <Note>{"Fullscreen works in browsers. In the desktop app's Preview it isn't available yet."}</Note>}
        </div>
      )}
    </InspectorSection>
  );
}
