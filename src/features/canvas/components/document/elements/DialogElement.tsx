"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type Ref,
} from "react";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveDialogElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { resolveDialogAccessibleDescription, resolveDialogAccessibleName } from "@/features/canvas/utils/resolveDialogAccessibleName";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A genuine native `<dialog>` (Checkpoint 1.15.6.9) — the first Canvas
 * element whose own visibility is partly owned by an imperative browser
 * API (`showModal()`/`close()`) rather than pure CSS. Deliberately its
 * own dedicated renderer, not ContainerElement (Part D of this
 * checkpoint's own brief): a generic Container has no concept of native
 * modal lifecycle, and — just as importantly — must never be handed
 * Flow/Flex/Grid layout authority over the dialog's OWN box the way
 * the container recipe's container-flow default/resolveFlowLayoutStyle would
 * (see elementCapabilities.ts's own `supportsChildLayout: false`
 * override for "dialog" — TableElement established this exact
 * "don't let generic layout fight a tag with special native formatting"
 * precedent first, for `<table>`). A Modal composition's own inner
 * Flex/gap/padding lives one level down, on an ordinary content
 * Container INSIDE this dialog (see interactionCompositions.ts's
 * createModalNode) — this element owns only the dialog's outer box
 * (size/position/background/border/shadow) and native show/hide.
 *
 * DESIGN VS PREVIEW — how the SAME generic runtime-visibility mechanism
 * every other interactive composition already uses (DocumentNodeRenderer's
 * own `isRuntimeHidden`, Checkpoint 1.15.6.8) already gives Dialog exactly
 * the behavior this checkpoint's brief asks for, with ZERO special-casing
 * in DocumentNodeRenderer itself: `isRuntimeHidden` is only ever true
 * while `editorMode === "preview"` — so in Design, this component is
 * ALWAYS mounted regardless of the node's own authored
 * `initialPreviewVisibility`, exactly like every other interaction target
 * (Dropdown's menu, Collapsible's content) already renders fully visible
 * and editable in Design. In Preview, this component is mounted ONLY
 * while `runtimeVisibility[node.id]` is true — meaning the moment this
 * component mounts during Preview, that mount IS the "should be open"
 * signal, and the moment it unmounts (Close Button's generic hide
 * binding, Style-Protection-irrelevant since behavior metadata is never
 * guarded, or generic executeInteractionsForNode flipping it false any
 * other way), that unmount IS the "should be closed" signal — this
 * component never needs to read `runtimeVisibility` itself at all, only
 * `isPreview`, keeping the generic executor and dismissal utilities
 * (executeInteractionsForNode, findDismissibleRelationships) completely
 * unaware that a "dialog" tag exists (Part 46/47 of this checkpoint's own
 * brief).
 *
 * NATIVE LIFECYCLE — one effect, keyed on `isPreview`, owns EVERY
 * imperative native call, and never lets React's own JSX-attribute
 * reconciliation touch the `open` attribute at all (it is set/cleared
 * exclusively via `showModal()`/`close()`/explicit `setAttribute` calls
 * below) — mixing a React-managed `open` prop with showModal()'s own
 * internal (spec-defined) attribute mutation would let the two fight over
 * the same attribute the moment they disagree, corrupting Design's own
 * post-Preview-exit visibility (traced concretely during this
 * checkpoint's own implementation: committing a declarative `open={true}`
 * BEFORE this effect's own cleanup calls the real `close()` leaves
 * React's fiber believing the attribute is present while the native call
 * actually just removed it). Design renders a plain, non-modal
 * `<dialog open>` — a genuine native primitive that behaves almost
 * exactly like an ordinary block box for layout/selection/resize
 * purposes (Part 8) — never `showModal()`, so it never reaches the
 * browser's top layer, never gets a backdrop, and never interferes with
 * Canvas geometry/selection (Part 7).
 */
export function DialogElement({ node, parentId, parentLayoutMode, parentFlowDisplay, children }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const setDialogRef = useCallback((element: HTMLElement | null) => {
    dialogRef.current = element as HTMLDialogElement | null;
  }, []);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const dismissRuntimeTarget = useEditorStore((state) => state.dismissRuntimeTarget);

  // Owns every imperative open/close transition (Part D/E/P). Reusing
  // the exact same `dismissRuntimeTarget` primitive Checkpoint 1.15.6.8.3
  // built for generic outside-click dismissal (Part K of this
  // checkpoint's own report) — it was already exactly "set this target's
  // runtime visibility to false, ephemeral, idempotent, safe if already
  // false," which is precisely what syncing Layoutry's own runtime state
  // back after a NATIVE close (Escape/cancel, backdrop, or an explicit
  // `.close()` call from anywhere) needs; no new store action exists for
  // this.
  // Checkpoint 1.15.6.9.1 — deliberately useLayoutEffect, not useEffect.
  // On unmount (the Close Button's generic hide binding flips
  // runtimeVisibility false, which unmounts this component entirely — see
  // this file's own top comment), a PASSIVE effect's cleanup runs AFTER
  // React has already removed the dialog's DOM node from the document
  // (commit happens first, passive cleanup is scheduled after paint) — by
  // the time `dialogEl.close()` ran there, the browser had already forced
  // the dialog out of the top layer via its own node-removal steps, which
  // do NOT run the same focus-restoration algorithm an explicit `close()`
  // call on a still-connected dialog does (confirmed live during this
  // checkpoint's own QA: Close-Button-driven close left focus on
  // `document.body`, never back on "Open Modal", while Escape/backdrop —
  // which call `dialogRef.current?.close()` directly, synchronously,
  // while still mounted — correctly restored it). A LAYOUT effect's
  // unmount cleanup runs synchronously, BEFORE React mutates the DOM for
  // that subtree, so `close()` now always runs while the dialog is still
  // genuinely connected, letting the browser's own native focus-restore
  // handle every closure path identically — no manual focus-tracking code
  // needed (Part 22/23 of this checkpoint's own brief).
  useLayoutEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;

    if (isPreview) {
      if (!dialogEl.open) dialogEl.showModal();
    } else {
      if (dialogEl.open) dialogEl.close();
      dialogEl.setAttribute("open", "");
    }

    const handleNativeClose = () => {
      // Per spec, `close()` fires its `close` event via a QUEUED element
      // task, not synchronously — it can still be pending when this exact
      // effect's own cleanup+re-setup pair runs back to back for the SAME
      // `isPreview` value (confirmed live during this checkpoint's own
      // development: React 18 Strict Mode deliberately double-invokes
      // every effect in dev, cleanup-then-immediately-re-setup, to catch
      // non-idempotent effects — this cleanup's own `close()` call queues
      // a `close` event that is still in flight when the re-setup's
      // `showModal()` reopens the SAME dialog a tick earlier than the
      // queued event fires). If the dialog is open again by the time this
      // handler actually runs, the event is stale — from a close() call
      // that has since been superseded by a real reopen — and must be
      // ignored, or it would incorrectly report a fresh, user-visible
      // Preview open as already dismissed.
      if (dialogEl.open) return;
      dismissRuntimeTarget(node.id);
    };
    dialogEl.addEventListener("close", handleNativeClose);

    return () => {
      dialogEl.removeEventListener("close", handleNativeClose);
      if (dialogEl.open) dialogEl.close();
      else dialogEl.removeAttribute("open");
    };
  }, [isPreview, node.id, dismissRuntimeTarget]);

  // Backdrop click (Part F) — native `<dialog>` does not close itself on
  // a backdrop click; `event.target === dialogRef.current` is the
  // established technique for telling a click on the generated backdrop
  // apart from a click on real content (every content click's target is
  // a DESCENDANT of the dialog, never the dialog element itself) — the
  // same technique this app's own components/ui/Dialog.tsx already uses
  // for its unrelated application-chrome dialog (precedent reused, not
  // shared code — see this checkpoint's own report, section A). Guarded
  // on `isPreview`: in Design, this element renders as a plain non-modal
  // box with no backdrop concept, and a click landing on its own empty
  // padding area must be ordinary Canvas blank-space behavior, not a
  // close.
  function handleBackdropClick(event: ReactMouseEvent) {
    if (isPreview && event.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  }

  // Native Escape priority (Part E/O) — deliberately NOT a new check
  // inside CanvasInteractionBoundary's own Escape handler. Calling
  // `stopPropagation()` here (bubble phase, on the exact same native
  // keydown event) stops it from ever reaching CanvasInteractionBoundary's
  // `window`-level listener at all — the identical technique
  // useNodeDragSource already established for pointerdown, and the one
  // Checkpoint 1.15.6.8.3's own audit traced all the way through
  // (confirmed: React's synthetic stopPropagation calls the real native
  // Event.stopPropagation(), which genuinely halts further native
  // bubbling past this point, not just React's own synthetic dispatch).
  // Deliberately never calls preventDefault: the browser's own default
  // action (closing the topmost modal dialog on Escape) must still run
  // exactly as it would with no Layoutry code present at all — only the
  // SECOND Escape (once this component's own effect has already
  // unmounted it, or the native close already ran) ever reaches Canvas's
  // generic dismissible-relationship/exit-Preview logic, giving the
  // "Escape #1 closes Modal, Escape #2 exits Preview" priority the
  // brief's own Part 20 asks for with no new priority-ordering code
  // anywhere else. Guarded on `isPreview && dialogEl.open` so Design's
  // own Escape (clearSelection) is never intercepted by a non-modal
  // Design-mode dialog that happens to hold DOM focus.
  function handleDialogKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "Escape" && isPreview && dialogRef.current?.open) {
      event.stopPropagation();
    }
  }

  // The Design/Preview positioning split (and its live-verified rationale)
  // lives in resolveDialogElementStyle, shared with HTML/CSS export.
  const recipe = resolveDialogElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

  // Checkpoint 1.15.6.9.1 — see resolveDialogAccessibleName.ts's own top
  // comment for why this is derived at render time rather than stored.
  // Honestly absent (not a synthesized fallback) for a bare Dialog with no
  // heading/paragraph descendant — matches this checkpoint's own bare-
  // Dialog honesty requirement.
  const accessibleName = resolveDialogAccessibleName(node);
  const accessibleDescription = resolveDialogAccessibleDescription(node);

  return (
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props -- this plugin's static ARIA role table predates aria-description being added as a global property in the current WAI-ARIA spec; verified live via Chromium's own CDP Accessibility.getFullAXTree that it correctly populates the dialog's computed accessible description (this checkpoint's own report, section A/B).
    <dialog
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, setDialogRef) as unknown as Ref<HTMLDialogElement>}
      {...documentNodeAttributes(node, parentId)}
      aria-label={accessibleName}
      aria-description={accessibleDescription}
      onClick={handleBackdropClick}
      onKeyDown={handleDialogKeyDown}
      className={cn(documentDefaultClasses(recipe.defaults), isDragging && "opacity-40", node.className)}
      style={recipe.style}
      {...listeners}
    >
      {children}
    </dialog>
  );
}
