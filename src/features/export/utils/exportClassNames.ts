import type { DocumentDefaultStyleId } from "@/features/canvas";
import type { ExportElement } from "@/features/export/types/exportIr";

/*
 * Generated class names (EXPORT-1.2). Everything generated lives under the
 * "ly-" prefix, which buildExportDocument refuses in authored classes, so
 * the two can never collide:
 * - `ly-<default id>`, e.g. `ly-heading`: a shared default presentation.
 * - `ly-node-<n>`, e.g. `ly-node-3`: one element's own authored styles,
 *   numbered in document order — stable for identical documents and
 *   never derived from random editor ids.
 * Every generated rule is a single class selector, so all of them have the
 * same specificity and source order alone decides the cascade.
 */

export function defaultStyleClassName(id: DocumentDefaultStyleId): string {
  return `ly-${id}`;
}

export function elementStyleClassName(element: ExportElement): string {
  return `ly-${element.styleKey}`;
}

/** The full class list a printed element carries: defaults, its own rule, then authored classes. */
export function exportElementClassNames(element: ExportElement): string[] {
  return [
    ...element.defaultStyles.map(defaultStyleClassName),
    ...(element.declarations.length > 0 ? [elementStyleClassName(element)] : []),
    ...element.authoredClassNames,
  ];
}
