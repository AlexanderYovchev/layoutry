/**
 * Hands a Blob to the user as a downloaded file (browser File API). The
 * object URL is revoked shortly after the download has started. Used for
 * text (downloadTextFile) and for binary packages (BC-07.3's website ZIP).
 *
 * Returning only means the browser was asked to download: it may still
 * ask the user, block the download or save it under another name.
 */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Some browsers start reading the URL after click() returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
