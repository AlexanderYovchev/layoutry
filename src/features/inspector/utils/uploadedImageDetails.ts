export interface UploadedImageDetails {
  fileName: string;
  width: number;
  height: number;
}

interface Entry extends UploadedImageDetails {
  src: string;
}

const MAX_ENTRIES = 64;
const entries = new Map<string, Entry>();

/**
 * What the Inspector knows about images uploaded in this session (BC-07.2):
 * the original file name and pixel size. Neither is saved: project format 2
 * has no field for them, and the decision was to add none. So they show
 * only while the Image still holds the exact source that was uploaded.
 * After a reopen or another source, the Inspector shows only what the data
 * URL itself says (format and size).
 */
export function rememberUploadedImage(nodeId: string, src: string, details: UploadedImageDetails): void {
  entries.delete(nodeId);
  entries.set(nodeId, { src, ...details });
  if (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
}

export function getUploadedImageDetails(nodeId: string, src: string | undefined): UploadedImageDetails | undefined {
  const entry = entries.get(nodeId);
  return entry && src !== undefined && entry.src === src ? entry : undefined;
}
