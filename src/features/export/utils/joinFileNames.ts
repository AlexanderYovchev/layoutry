/** "index.html, styles.css and script.js" — for messages naming generated files. */
export function joinFileNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
