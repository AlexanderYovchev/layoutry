/**
 * SHA-256 of a text's UTF-8 bytes, as lowercase hex (PROJECT-1.4 recovery
 * snapshots) — the same value the desktop main process computes with
 * node:crypto. Web Crypto exists only in secure contexts (https,
 * localhost, the desktop app:// origin); see canHashText.
 */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function canHashText(): boolean {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.subtle?.digest === "function" &&
    typeof TextEncoder !== "undefined"
  );
}
