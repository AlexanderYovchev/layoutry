import {
  FORBIDDEN_JSON_KEYS,
  type ProjectLimits,
} from "@/features/project/rules/projectLimits";
import type { ProjectLoadError } from "@/features/project/types/projectFile";

/**
 * First line of defense for parsed, untrusted JSON: walks it with an
 * explicit stack (never recursion), so arbitrarily deep or wide hostile
 * input is measured and rejected before any recursive validation runs.
 * Rejects excessive depth, excessive size and prototype-pollution keys.
 */
export function scanJsonStructure(
  value: unknown,
  limits: Pick<ProjectLimits, "maxJsonDepth" | "maxJsonValues">,
): ProjectLoadError | null {
  const stack: { value: unknown; depth: number; path: string }[] = [
    { value, depth: 1, path: "" },
  ];
  let count = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    count += 1;
    if (count > limits.maxJsonValues) {
      return {
        code: "too-complex",
        message: `The project file contains more than ${limits.maxJsonValues} values.`,
      };
    }
    if (current.value === null || typeof current.value !== "object") continue;
    if (current.depth > limits.maxJsonDepth) {
      return {
        code: "too-complex",
        message: `The project file is nested more than ${limits.maxJsonDepth} levels deep.`,
        path: current.path || undefined,
      };
    }

    if (Array.isArray(current.value)) {
      current.value.forEach((item, index) =>
        stack.push({
          value: item,
          depth: current.depth + 1,
          path: `${current.path}[${index}]`,
        }),
      );
      continue;
    }
    for (const key of Object.keys(current.value)) {
      const path = current.path ? `${current.path}.${key}` : key;
      if (FORBIDDEN_JSON_KEYS.has(key)) {
        return {
          code: "forbidden-key",
          message: `The project file contains a forbidden key "${key}".`,
          path,
        };
      }
      stack.push({
        value: Reflect.get(current.value, key),
        depth: current.depth + 1,
        path,
      });
    }
  }
  return null;
}
