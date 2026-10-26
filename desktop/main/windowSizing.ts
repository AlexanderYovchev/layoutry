export interface Size {
  width: number;
  height: number;
}

/**
 * BrowserWindow minimums constrain the OUTER window — frame and title bar
 * included — but the editor's floor (900px wide, see AppShell's
 * MIN_SUPPORTED_VIEWPORT_WIDTH) applies to its viewport, the window's
 * content area. Returns the outer minimum that guarantees the content
 * area is at least `contentMinimum`, given the window's current outer and
 * content sizes (their difference is the frame).
 */
export function outerMinimumForContent(
  contentMinimum: Size,
  outer: Size,
  content: Size,
): Size {
  return {
    width: contentMinimum.width + Math.max(0, outer.width - content.width),
    height: contentMinimum.height + Math.max(0, outer.height - content.height),
  };
}
