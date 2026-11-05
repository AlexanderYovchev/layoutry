/**
 * Layoutry's policy for authored embeds (BC-02.3), shared by the Canvas
 * (Design and Preview) and the HTML export so both treat an <iframe> the
 * same way.
 *
 * Source: only http:, https:, protocol-relative and relative URLs are
 * framed — the same set the export already accepts for frames. data:,
 * blob:, file:, about:, javascript: and every other scheme are not loaded
 * at all: data:/blob: would run a document the author typed in, and the
 * rest are local or meaningless as an embed.
 *
 * Sandbox: always present, so the framed page can never navigate or
 * replace the page around it. Granted, and why:
 *   allow-scripts  embeds (players, maps, widgets) are script-driven
 *   allow-forms    a search box or form inside the embed submits in-frame
 *   allow-popups   "open in a new tab" links; popups stay sandboxed,
 *                  because allow-popups-to-escape-sandbox is never given
 * allow-same-origin is added only when the framed URL is on a different
 * origin from the host page. A cross-origin page then keeps its own origin
 * (its cookies and storage work) and the same-origin policy still keeps it
 * out of the host. A same-origin or relative URL never gets it: with
 * allow-scripts it could reach into the host and remove its own sandbox.
 * Never granted: allow-top-navigation, allow-top-navigation-by-user-
 * activation, allow-top-navigation-to-custom-protocols,
 * allow-popups-to-escape-sandbox, allow-modals, allow-downloads,
 * allow-pointer-lock, allow-presentation, allow-orientation-lock,
 * allow-storage-access-by-user-activation.
 */

const FRAMEABLE_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

const BASE_SANDBOX_TOKENS = ["allow-forms", "allow-popups", "allow-scripts"] as const;

/**
 * Stand-in host origin for an exported page, whose real origin is unknown:
 * a relative frame URL is then on the same origin as the page, and an
 * absolute or protocol-relative one is treated as another origin.
 */
export const EXPORTED_PAGE_ORIGIN = "https://exported-page.invalid";

export interface IframeSourcePolicy {
  /** The authored source, unchanged, when it may be framed; otherwise undefined. */
  src: string | undefined;
  /** True when a non-empty source was refused (unsupported scheme or unparseable). */
  refused: boolean;
  /** The sandbox attribute value to render. Always set. */
  sandbox: string;
}

/**
 * Resolves what to render for an authored iframe `src` on a page served
 * from `hostOrigin` (for example `window.location.origin`).
 */
export function resolveIframeSourcePolicy(src: string | undefined, hostOrigin: string): IframeSourcePolicy {
  const strict = BASE_SANDBOX_TOKENS.join(" ");
  if (src === undefined || src.trim() === "") return { src: undefined, refused: false, sandbox: strict };
  let url: URL;
  try {
    url = new URL(src, `${hostOrigin}/`);
  } catch {
    return { src: undefined, refused: true, sandbox: strict };
  }
  if (!FRAMEABLE_PROTOCOLS.has(url.protocol)) return { src: undefined, refused: true, sandbox: strict };
  const sandbox = url.origin === hostOrigin ? strict : `${strict} allow-same-origin`;
  return { src, refused: false, sandbox };
}
