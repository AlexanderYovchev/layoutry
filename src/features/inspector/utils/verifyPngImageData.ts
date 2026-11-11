/**
 * Proves a PNG's compressed image data is real (BC-07.4). The header and
 * chunk structure can be perfect while the IDAT bytes are garbage; Firefox
 * and WebKit then still "decode" the file (blank, or broken on display)
 * instead of failing. So the IDAT stream is inflated with the browser's own
 * zlib (DecompressionStream "deflate" is the RFC 1950 format PNG uses), and
 * it must decompress without error to at least the bytes the header says
 * the image needs. Output is only counted, never kept, so memory stays flat.
 *
 * Returns true when the data is complete, false when it is damaged, and
 * null when the environment has no DecompressionStream (the decode check
 * then decides alone).
 */
export async function verifyPngImageData(bytes: Uint8Array): Promise<boolean | null> {
  if (typeof DecompressionStream === "undefined") return null;
  const expected = expectedRawLength(bytes);
  if (expected === null) return false;

  const parts: Uint8Array[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = ((bytes[offset] << 24) >>> 0) + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (type === "IDAT") parts.push(bytes.subarray(offset + 8, offset + 8 + length));
    if (type === "IEND") break;
    offset += 12 + length;
  }
  if (parts.length === 0) return false;

  try {
    const inflater = new DecompressionStream("deflate");
    const writer = inflater.writable.getWriter();
    // Written concurrently with reading (backpressure); a stream error or an
    // early cancel rejects these writes, which is expected and ignored here.
    void (async () => {
      for (const part of parts) await writer.write(new Uint8Array(part));
      await writer.close();
    })().catch(() => undefined);
    const reader = inflater.readable.getReader();
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      // Enough proves the stream is real; stop rather than inflate far past it.
      if (total >= expected) {
        await reader.cancel().catch(() => undefined);
        return true;
      }
    }
    return total >= expected;
  } catch {
    return false;
  }
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const ADAM7: readonly [number, number, number, number][] = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

/** Filtered (pre-compression) image size from IHDR: one filter byte per row plus the row's pixel bytes, per Adam7 pass when interlaced. */
function expectedRawLength(bytes: Uint8Array): number | null {
  if (bytes.length < 33) return null;
  const read = (index: number) => ((bytes[index] << 24) >>> 0) + ((bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3]);
  const width = read(16);
  const height = read(20);
  const bitDepth = bytes[24];
  const channels = CHANNELS[bytes[25]];
  const interlace = bytes[28];
  if (!channels || ![1, 2, 4, 8, 16].includes(bitDepth) || width === 0 || height === 0) return null;
  const rowBytes = (pixels: number) => Math.ceil((pixels * channels * bitDepth) / 8);
  if (interlace === 0) return height * (1 + rowBytes(width));
  if (interlace !== 1) return null;
  let total = 0;
  for (const [x0, y0, dx, dy] of ADAM7) {
    const passWidth = Math.ceil((width - x0) / dx);
    const passHeight = Math.ceil((height - y0) / dy);
    if (passWidth > 0 && passHeight > 0) total += passHeight * (1 + rowBytes(passWidth));
  }
  return total;
}
