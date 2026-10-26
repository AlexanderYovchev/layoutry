/**
 * Deterministic JSON for project files: object keys sorted (so equivalent
 * documents built in different key orders produce byte-identical files and
 * clean diffs), array order kept, undefined properties omitted. Throws on
 * values JSON cannot faithfully represent instead of silently dropping or
 * mangling them. Only call on input whose depth is already bounded (see
 * checkDocumentIntegrity) — this recursion is not meant for hostile input.
 */
export function toCanonicalJsonValue(value: unknown, path = "$"): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError(`${path} is not a finite number`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (item === undefined)
        throw new TypeError(`${path}[${index}] is undefined`);
      return toCanonicalJsonValue(item, `${path}[${index}]`);
    });
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} is not a plain object`);
    }
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const entry: unknown = Reflect.get(value, key);
      if (entry !== undefined)
        result[key] = toCanonicalJsonValue(entry, `${path}.${key}`);
    }
    return result;
  }
  throw new TypeError(`${path} has unsupported type ${typeof value}`);
}
