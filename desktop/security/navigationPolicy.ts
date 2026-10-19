import { APP_HOST, APP_SCHEME } from "../protocol/appOrigin";

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

/** True only for URLs on the bundled app origin, app://layoutry/. */
export function isAppUrl(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);
  return (
    url !== null &&
    url.protocol === `${APP_SCHEME}:` &&
    url.hostname === APP_HOST &&
    url.port === "" &&
    url.username === "" &&
    url.password === ""
  );
}

/**
 * The main window may only ever show the bundled editor. Anything else —
 * an authored link, a form submission, an iframe navigating `top`, a
 * file: URL, an unknown scheme — is denied rather than handed to the OS:
 * none of it is a deliberate user request to leave Layoutry.
 */
export function isAllowedTopLevelNavigation(rawUrl: string): boolean {
  return isAppUrl(rawUrl);
}

/**
 * Authored iframes may browse the web (http/https) and start blank, but
 * may never load local files, the privileged app origin, or other schemes.
 */
export function isAllowedSubframeNavigation(rawUrl: string): boolean {
  if (rawUrl === "about:blank") return true;
  const url = parseUrl(rawUrl);
  return (
    url !== null && (url.protocol === "http:" || url.protocol === "https:")
  );
}
