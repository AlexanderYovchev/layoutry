import type { EditorElementNode } from "../../src/features/editor/types/document";

/**
 * BC-17.3 performance fixture: a Free container (760 × 2,600) with 999
 * Free children in a 20-column grid — paragraphs, buttons and boxes with
 * typography, background, border, radius and some shadows — so every
 * element carries real authored CSS and default presentations.
 */
export function perfDocument(): EditorElementNode {
  const children: EditorElementNode[] = [];
  for (let index = 0; index < 999; index += 1) {
    const column = index % 20;
    const row = Math.floor(index / 20);
    const kind = index % 3;
    children.push({
      id: `n-${index}`,
      tag: kind === 0 ? "p" : kind === 1 ? "button" : "div",
      ...(kind === 2 ? {} : { text: `Item ${index}` }),
      freeLayout: {
        x: column * 37 + 4,
        y: row * 50 + 4,
        width: 34,
        height: 44,
      },
      typography:
        kind === 2
          ? undefined
          : { fontSize: { value: 11, unit: "px" }, color: "#1f2937" },
      background: { color: index % 2 === 0 ? "#e0f2fe" : "#fef3c7" },
      border: {
        top: {
          width: { value: 1, unit: "px" },
          style: "solid",
          color: "#94a3b8",
        },
      },
      borderRadius: { topLeft: { value: 4, unit: "px" } },
      ...(index % 5 === 0
        ? {
            boxShadow: [
              {
                id: `s-${index}`,
                enabled: true,
                inset: false,
                offsetY: { value: 1, unit: "px" },
                blur: { value: 2, unit: "px" },
                color: "#00000033",
              },
            ],
          }
        : {}),
    });
  }
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "free",
        tag: "div",
        layoutMode: "free",
        dimensions: {
          preferredWidth: 760,
          preferredHeight: 2600,
          offsetX: 0,
          offsetY: 0,
        },
        children,
      },
    ],
  };
}
