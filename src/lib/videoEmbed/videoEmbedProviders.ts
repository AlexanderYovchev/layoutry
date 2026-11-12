/**
 * Layoutry's video provider registry (BC-08.2). Every provider-specific
 * fact lives here, so the parser, the URL builders, the Inspector and the
 * export read one table instead of spreading host names and parameter
 * rules across components.
 *
 * A provider is listed as SUPPORTED only when it has a documented embed
 * URL Layoutry can build from a validated identifier, documented settings,
 * a Preview/Export path that needs nothing Layoutry cannot supply, and
 * tests. Providers whose embeds need information Layoutry cannot know are
 * listed as DEFERRED: their links are recognized so the user gets an exact
 * reason, but no embed URL is ever built for them.
 *
 * Capability status:
 *   "documented"   the provider's own documentation describes the setting
 *   "unverified"   in common use, but not on the provider's official
 *                  parameter page; must be confirmed live (BC-08.3)
 *   "unsupported"  the provider offers no URL setting Layoutry can use;
 *                  the Inspector hides the control and explains why
 * Real playback behavior of every setting is verified in BC-08.3.
 */

export type VideoEmbedProviderId = "youtube" | "vimeo" | "loom" | "wistia";
export type DeferredVideoProviderId = "dailymotion" | "twitch";

export type VideoEmbedCapability = "autoplay" | "muted" | "loop" | "controls" | "startTime" | "privacyMode" | "fullscreen";
export type VideoEmbedCapabilityStatus = "documented" | "unverified" | "unsupported";

export interface VideoEmbedProvider {
  id: VideoEmbedProviderId;
  displayName: string;
  /** The accessible title a new embed of this provider gets. */
  defaultTitle: string;
  /** The exact embed host(s) Layoutry ever builds URLs for (https only). */
  embedHosts: readonly string[];
  capabilities: Readonly<Record<VideoEmbedCapability, VideoEmbedCapabilityStatus>>;
  /** Why a capability is unsupported, shown next to where its control would be. */
  unsupportedNotes: Readonly<Partial<Record<VideoEmbedCapability, string>>>;
  /** The provider's own rules Layoutry cannot override. */
  limitations: readonly string[];
}

export const VIDEO_EMBED_PROVIDERS: Readonly<Record<VideoEmbedProviderId, VideoEmbedProvider>> = {
  youtube: {
    id: "youtube",
    displayName: "YouTube",
    defaultTitle: "YouTube video",
    embedHosts: ["www.youtube-nocookie.com", "www.youtube.com"],
    capabilities: {
      autoplay: "documented",
      // `mute` is not on YouTube's player-parameters page.
      muted: "unverified",
      // Needs playlist=<same id> for a single video (documented).
      loop: "documented",
      controls: "documented",
      startTime: "documented",
      // youtube-nocookie.com is not on the player-parameters page.
      privacyMode: "unverified",
      fullscreen: "documented",
    },
    unsupportedNotes: {},
    limitations: [
      "YouTube needs the page's address (the Referer) to play. A page opened as a local file may show a player error.",
      "The video's owner can turn embedding off.",
    ],
  },
  vimeo: {
    id: "vimeo",
    displayName: "Vimeo",
    defaultTitle: "Vimeo video",
    embedHosts: ["player.vimeo.com"],
    capabilities: {
      autoplay: "documented",
      muted: "documented",
      loop: "documented",
      // controls=0 only works when the VIDEO OWNER has a paid plan.
      controls: "unsupported",
      startTime: "documented",
      privacyMode: "documented",
      fullscreen: "documented",
    },
    unsupportedNotes: {
      controls: "Vimeo shows its own controls. Hiding them needs the video owner's paid Vimeo plan.",
    },
    limitations: [
      "The video's owner can limit which websites may embed it.",
      "Unlisted videos need their full link, including the code after the video number.",
    ],
  },
  loom: {
    id: "loom",
    displayName: "Loom",
    defaultTitle: "Loom video",
    embedHosts: ["www.loom.com"],
    capabilities: {
      autoplay: "documented",
      muted: "documented",
      loop: "unsupported",
      controls: "unsupported",
      startTime: "documented",
      privacyMode: "unsupported",
      fullscreen: "documented",
    },
    unsupportedNotes: {
      loop: "Loom videos can't loop.",
      controls: "Loom always shows its own controls.",
      privacyMode: "Loom has no privacy-enhanced mode.",
    },
    limitations: ['The video must be shared with "Anyone with the link".'],
  },
  wistia: {
    id: "wistia",
    displayName: "Wistia",
    defaultTitle: "Wistia video",
    embedHosts: ["fast.wistia.net"],
    capabilities: {
      autoplay: "documented",
      muted: "documented",
      // endVideoBehavior=loop.
      loop: "documented",
      // Only playbar/controlsVisibleOnLoad exist, neither is "no controls".
      controls: "unsupported",
      // time=<seconds>.
      startTime: "documented",
      // doNotTrack=true.
      privacyMode: "documented",
      fullscreen: "documented",
    },
    unsupportedNotes: {
      controls: "Wistia's controls are set in the video owner's Wistia account.",
    },
    limitations: ["Only Wistia's own links are accepted, not custom-domain links."],
  },
};

export interface DeferredVideoProvider {
  id: DeferredVideoProviderId;
  displayName: string;
  /** Shown when a link from this provider is pasted. */
  blocker: string;
}

export const DEFERRED_VIDEO_PROVIDERS: Readonly<Record<DeferredVideoProviderId, DeferredVideoProvider>> = {
  dailymotion: {
    id: "dailymotion",
    displayName: "Dailymotion",
    blocker:
      "Dailymotion videos aren't supported yet. Their embed needs a player set up in the owner's Dailymotion account, and autoplay can't be controlled from the page.",
  },
  twitch: {
    id: "twitch",
    displayName: "Twitch",
    blocker: "Twitch videos aren't supported yet. Twitch requires the exact website address the video will appear on, which isn't known while you design.",
  },
};

export function isVideoEmbedProviderId(id: string): id is VideoEmbedProviderId {
  return Object.hasOwn(VIDEO_EMBED_PROVIDERS, id);
}

export function isDeferredVideoProviderId(id: string): id is DeferredVideoProviderId {
  return Object.hasOwn(DEFERRED_VIDEO_PROVIDERS, id);
}

export function getVideoEmbedProvider(id: VideoEmbedProviderId): VideoEmbedProvider {
  return VIDEO_EMBED_PROVIDERS[id];
}

/** True when the provider has a URL setting for this capability (documented or unverified). */
export function providerSupports(id: VideoEmbedProviderId, capability: VideoEmbedCapability): boolean {
  return VIDEO_EMBED_PROVIDERS[id].capabilities[capability] !== "unsupported";
}
