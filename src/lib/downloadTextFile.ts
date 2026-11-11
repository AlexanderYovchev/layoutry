import { downloadBlob } from "@/lib/downloadBlob";

/**
 * Hands text to the user as a downloaded file (browser File API). The
 * object URL is revoked shortly after the download has started. Shared by
 * project downloads (PROJECT-1.2) and code export (EXPORT-1.4).
 *
 * Returning only means the browser was asked to download: it may still
 * ask the user, block the download or save it under another name.
 */
export function downloadTextFile(
  fileName: string,
  text: string,
  mediaType: string,
): void {
  downloadBlob(fileName, new Blob([text], { type: mediaType }));
}
