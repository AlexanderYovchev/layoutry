/**
 * Deep equality for plain document data (BC-01.3) — objects, arrays and
 * primitives, as the serializable document model is made of. A key whose
 * value is `undefined` counts as absent, matching how the document
 * serializes (`{ typography: undefined }` equals `{}`), and key order is
 * ignored. Identical references short-circuit, so comparing two documents
 * that share most of their structure only walks the parts that differ.
 */
export function isStructurallyEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => isStructurallyEqual(item, b[index]));
  }

  const aEntries = Object.entries(a).filter(([, value]) => value !== undefined);
  const bDefined = new Map(Object.entries(b).filter(([, value]) => value !== undefined));
  if (aEntries.length !== bDefined.size) return false;
  return aEntries.every(([key, value]) => bDefined.has(key) && isStructurallyEqual(value, bDefined.get(key)));
}
