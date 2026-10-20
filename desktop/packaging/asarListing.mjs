// Reads the file list of an ASAR archive straight from its header, with no
// extra dependency. ASAR layout: an 8-byte Chromium pickle holding the
// header size, then a pickle holding the JSON header string.
import { open } from "node:fs/promises";

/** @returns {Promise<string[]>} every file path in the archive, "/"-separated */
export async function listAsarFiles(asarPath) {
  const handle = await open(asarPath, "r");
  try {
    const sizeBuffer = Buffer.alloc(8);
    await handle.read(sizeBuffer, 0, 8, 0);
    const headerPickleSize = sizeBuffer.readUInt32LE(4);
    const headerBuffer = Buffer.alloc(headerPickleSize);
    await handle.read(headerBuffer, 0, headerPickleSize, 8);
    const jsonLength = headerBuffer.readInt32LE(4);
    const header = JSON.parse(headerBuffer.toString("utf8", 8, 8 + jsonLength));

    const files = [];
    const walk = (node, prefix) => {
      for (const [name, entry] of Object.entries(node.files ?? {})) {
        const entryPath = prefix ? `${prefix}/${name}` : name;
        if (entry.files) walk(entry, entryPath);
        else files.push(entryPath);
      }
    };
    walk(header, "");
    return files.sort();
  } finally {
    await handle.close();
  }
}
