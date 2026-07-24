/**
 * The single source of truth for "can this node type be resized." Only
 * Container (div/section) and Image opt in for this checkpoint; every
 * other tag — including the leaf text elements and the document root/body
 * — is rejected. Reused by ResizeOverlay (whether to show handles) and
 * resizeNode (whether to accept the mutation), so a future element type
 * opts into resizing by adding one tag here, never by touching the resize
 * engine itself.
 */
const RESIZABLE_TAGS: ReadonlySet<string> = new Set(["div", "section", "img"]);

export function canResizeElement(tag: string): boolean {
  return RESIZABLE_TAGS.has(tag);
}
