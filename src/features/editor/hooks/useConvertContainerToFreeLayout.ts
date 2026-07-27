import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { getLayoutMode } from "@/features/editor/types/layout";
import type { FreeContainerSelfUpdate } from "@/features/editor/commands/layoutCommands";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";

function pixels(value: string): number {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Flow -> Free conversion (Checkpoint 3.4.4): measures the container's
 * current content-box inset and each direct child's rendered rect, one
 * time, converts them into container-content-relative FreeLayoutGeometry,
 * and hands the whole set to the store's convertToFreeLayout action —
 * one atomic, one-history-entry write that preserves the exact visual
 * composition the user already sees in Flow.
 *
 * Also measures the container's *own* current outer size and includes it
 * as selfUpdate: once its children switch to position: absolute, they no
 * longer contribute to the container's auto-height, so without an
 * explicit size the container would visually collapse the instant
 * conversion completes. Whether that size is stored as dimensions (the
 * container is itself a Flow child) or freeLayout (a Free child) depends
 * on the container's *own* parent's layoutMode, resolved from the
 * document model rather than the DOM.
 *
 * A direct `window.document.querySelector` read with no canvasRootRef,
 * following the same precedent already set by useRenderedNodeSize (an
 * editor hook, not a canvas one) — there is exactly one Canvas per app
 * instance, so the Inspector (where this is invoked from) never needs to
 * import anything from the canvas feature to trigger this measurement.
 */
export function useConvertContainerToFreeLayout() {
  const convertToFreeLayout = useEditorStore((state) => state.convertToFreeLayout);

  return function convert(containerId: string) {
    const containerEl = window.document.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(containerId)}"]`,
    );
    if (!containerEl) return;

    const containerRect = containerEl.getBoundingClientRect();
    const style = getComputedStyle(containerEl);
    const insetLeft = pixels(style.borderLeftWidth) + pixels(style.paddingLeft);
    const insetTop = pixels(style.borderTopWidth) + pixels(style.paddingTop);

    const childGeometries: Record<string, FreeLayoutGeometry> = {};
    for (const child of containerEl.querySelectorAll<HTMLElement>(":scope > [data-node-id]")) {
      const childId = child.getAttribute("data-node-id");
      if (!childId) continue;

      const childRect = child.getBoundingClientRect();
      childGeometries[childId] = {
        x: childRect.left - containerRect.left - insetLeft,
        y: childRect.top - containerRect.top - insetTop,
        width: childRect.width,
        height: childRect.height,
      };
    }

    const documentModel = useEditorStore.getState().document;
    const containerParentId = findParentId(documentModel, containerId);
    const containerParent = containerParentId ? findNodeById(documentModel, containerParentId) : undefined;
    const containerIsFreeChild = containerParent ? getLayoutMode(containerParent) === "free" : false;

    let selfUpdate: FreeContainerSelfUpdate;
    if (containerIsFreeChild) {
      const parentEl = containerEl.parentElement?.closest<HTMLElement>("[data-node-id]");
      const parentRect = parentEl?.getBoundingClientRect();
      const parentStyle = parentEl ? getComputedStyle(parentEl) : undefined;
      const parentInsetLeft = parentStyle
        ? pixels(parentStyle.borderLeftWidth) + pixels(parentStyle.paddingLeft)
        : 0;
      const parentInsetTop = parentStyle ? pixels(parentStyle.borderTopWidth) + pixels(parentStyle.paddingTop) : 0;

      selfUpdate = {
        freeLayout: {
          x: parentRect ? containerRect.left - parentRect.left - parentInsetLeft : 0,
          y: parentRect ? containerRect.top - parentRect.top - parentInsetTop : 0,
          width: containerRect.width,
          height: containerRect.height,
        },
      };
    } else {
      selfUpdate = {
        dimensions: {
          preferredWidth: containerRect.width,
          preferredHeight: containerRect.height,
          offsetX: 0,
          offsetY: 0,
        },
      };
    }

    convertToFreeLayout(containerId, childGeometries, selfUpdate);
  };
}
