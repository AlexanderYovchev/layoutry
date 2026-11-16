import type { VideoEmbedProviderId } from "@/lib/videoEmbed/videoEmbedProviders";

/**
 * The desktop shell's Video Embed frame registration (BC-08.4), or null in a
 * browser. The editor names each player iframe it mounts with a fresh
 * random token and registers { token, provider } before giving the iframe
 * its src; the main process then verifies the actual frame (direct child,
 * same name, exact provider origin) before it adds the Referer the
 * provider needs or grants fullscreen. Registration grants nothing by
 * itself. Generic Embeds are never named or registered.
 */
export interface DesktopVideoEmbedFrames {
  register(token: string, provider: VideoEmbedProviderId): Promise<void>;
  unregister(token: string): Promise<void>;
}

export function getDesktopVideoEmbedFrames(): DesktopVideoEmbedFrames | null {
  if (typeof window === "undefined") return null;
  const bridge: unknown = Reflect.get(window, "layoutryDesktop");
  if (typeof bridge !== "object" || bridge === null) return null;
  const register: unknown = Reflect.get(bridge, "registerVideoEmbedFrame");
  const unregister: unknown = Reflect.get(bridge, "unregisterVideoEmbedFrame");
  if (typeof register !== "function" || typeof unregister !== "function") return null;
  return {
    register: async (token, provider) => {
      await Reflect.apply(register, bridge, [token, provider]);
    },
    unregister: async (token) => {
      await Reflect.apply(unregister, bridge, [token]);
    },
  };
}

/** `ly-video-` + 32 random hex digits (128 bits): unguessable, never reused. */
export function createVideoEmbedFrameToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `ly-video-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
