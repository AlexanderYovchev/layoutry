/**
 * The longest file the code preview shows in full (EXPORT-1.4). Measured
 * in Chromium, a <pre>'s layout grows linearly with its text: ~90 ms at
 * 400,000 characters, ~480 ms at 2 MB and ~1 s at 5 MB. A 20,000-element
 * page (the project maximum) exports a 1.5 MB index.html and a 1.9 MB
 * styles.css. Copy and download always use the complete file — only what
 * is displayed is bounded.
 */
export const MAX_PREVIEW_CHARACTERS = 400_000;

export interface ExportPreviewText {
  text: string;
  truncated: boolean;
  totalLines: number;
  shownLines: number;
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  let lines = 1;
  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) lines += 1;
  // A final newline ends the last line rather than starting another.
  return text.endsWith("\n") ? lines - 1 : lines;
}

/** The file's text for display, cut at a line boundary when it is too long to show. */
export function boundExportPreview(content: string, maxCharacters: number = MAX_PREVIEW_CHARACTERS): ExportPreviewText {
  const totalLines = countLines(content);
  if (content.length <= maxCharacters) return { text: content, truncated: false, totalLines, shownLines: totalLines };
  const lastBreak = content.lastIndexOf("\n", maxCharacters - 1);
  const text = content.slice(0, lastBreak > 0 ? lastBreak + 1 : maxCharacters);
  return { text, truncated: true, totalLines, shownLines: countLines(text) };
}
