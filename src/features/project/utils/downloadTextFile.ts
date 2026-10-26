/**
 * Hands text to the user as a downloaded file (browser File API). The
 * object URL is revoked shortly after the download has started.
 */
export function downloadTextFile(
  fileName: string,
  text: string,
  mediaType: string,
): void {
  const url = URL.createObjectURL(new Blob([text], { type: mediaType }));
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
