import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Video Embed identity (BC-08.2). A Video Embed is the existing Embed
 * element (`tag: "iframe"`) created from the "Video Embed" library card.
 * It is told apart from a generic Embed by an existing document field, so
 * the project format (version 2) and its strict schema are unchanged:
 *
 *   tag === "iframe" AND `controls` is set (true or false).
 *
 * `controls` already exists on every node (Video/Audio's player-controls
 * setting) and means the same thing here: the video player's controls.
 * createVideoEmbedNode always stores it, and nothing in Layoutry ever sets
 * it on a generic Embed (the Embed Inspector has no such control), so:
 * - an empty Video Embed (no URL yet) is still a Video Embed;
 * - save/reopen, copy/paste, duplicate, undo and redo keep it, because
 *   they keep every field;
 * - an existing generic Embed is never turned into a Video Embed, whatever
 *   its URL (the URL's host is not what decides).
 * The Video Embed Inspector never offers a Reset that clears `controls`.
 * Only a hand-edited project file that puts `controls` on an iframe would
 * be read as a Video Embed.
 */
export function isVideoEmbedNode(node: Pick<EditorElementNode, "tag" | "controls">): boolean {
  return node.tag === "iframe" && node.controls !== undefined;
}
