/**
 * Copies plain text — never HTML — to the clipboard (EXPORT-1.4). Uses
 * the async Clipboard API, and falls back to a hidden read-only textarea
 * plus execCommand("copy") where that API is missing or refused (an
 * insecure http origin, an older engine). Resolves false when neither
 * worked, so the caller can say so instead of claiming success.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or not focused: try the fallback below.
  }
  return copyWithSelection(text);
}

function copyWithSelection(text: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  // Inside an open modal <dialog> when there is one: everything outside it is inert and can't be selected.
  const host = document.querySelector("dialog[open]") ?? document.body;
  host.append(textarea);
  try {
    textarea.focus();
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    previousFocus?.focus();
  }
}
