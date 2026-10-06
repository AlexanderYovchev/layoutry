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
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveAspectRatioStyle } from "@/features/canvas/utils/resolveAspectRatioStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolveDialogAccessibleDescription, resolveDialogAccessibleName } from "@/features/canvas/utils/resolveDialogAccessibleName";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { resolveTransitionStyle } from "@/features/canvas/utils/resolveTransitionStyle";
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
 * ContainerElement's usesLegacyFlexClasses/resolveFlowLayoutStyle would
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

  const usesLegacyRadiusChrome = !node.borderRadius;
  const usesLegacyBorderChrome = !node.border;

  // Checkpoint 1.15.6.11.3 — generic centering-vs-explicit-positioning
  // split, verified live via an isolated CSS ground-truth probe before
  // being written here (see this checkpoint's own report, Part C). Chrome's
  // real `dialog:modal` UA rule is effectively `inset: 0; width/height:
  // fit-content; margin: auto` — exactly what makes Modal's own
  // no-authored-position case center correctly. The unconditional
  // `margin: auto` this file already applied in Preview (Checkpoint
  // 1.15.6.9.1) is scoped here to ONLY the case where the author hasn't
  // opted into an explicit CSS `position` (the pre-existing, already-
  // generic PositionSettings field — no new field) — once an author sets
  // e.g. `position: fixed` with authored offsets (an edge-anchored Drawer),
  // margin: auto would silently re-center the box over those offsets
  // (confirmed live: it ignores authored top/right/bottom entirely and
  // centers using the dialog's own intrinsic content size instead).
  //
  // The companion `height: auto` override undoes the OTHER half of that
  // same UA rule — `height: fit-content` — which is not something
  // resolvePositionStyle (top/right/bottom/left/zIndex only) can ever
  // touch, and which otherwise silently prevents an author's own
  // `top: 0; bottom: 0` from stretching the box to fill the viewport
  // (confirmed live: with fit-content still in effect, bottom is ignored
  // as over-constrained and the box just shrink-wraps its own content at
  // the top edge instead of spanning full height). Explicit `auto` restores
  // the ordinary CSS abspos rule ("top and bottom both set, height auto ->
  // solve height to fill the gap"), which is also confirmed live to track
  // the viewport dynamically, not a one-time computed pixel value. Applied
  // only in Preview (Design never uses showModal()/the top layer, so
  // neither UA rule is ever in effect there) and only when the author has
  // an explicit non-static position, so Modal's own centering path is
  // untouched by construction — this reads an existing generic field, adds
  // no new one, and does not know Drawer/Modal/any composition by name.
  const hasExplicitPosition = node.position?.position !== undefined && node.position.position !== "static";

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
      className={cn(
        "max-w-none bg-white p-8 text-zinc-900 backdrop:bg-black/40 dark:bg-zinc-950 dark:text-zinc-50",
        usesLegacyRadiusChrome && "rounded-lg",
        usesLegacyBorderChrome && "border border-zinc-100 dark:border-zinc-900",
        isDragging && "opacity-40",
        node.className,
      )}
      style={{
        // Chrome's own UA stylesheet gives even a non-modal `<dialog
        // open>` `position: absolute` by default (confirmed directly
        // during this checkpoint's own live QA — a fresh `<dialog open>`
        // with no authored styling computes `position: absolute`,
        // floating centered over its own siblings instead of
        // participating in normal flow) — genuinely unlike every other
        // tag this app renders, none of which need a base default here
        // since their own UA defaults already are static/in-flow. This
        // base default restores ordinary Design-mode flow participation
        // (Part 7/8 of this checkpoint's own brief: Dialog must remain
        // inside Canvas flow/layout, fully editable); resolvePositionStyle
        // is still spread AFTER it, so an authored Position setting (or
        // Free-child placement) still wins exactly like every other
        // element already allows. Deliberately Design-only (`!isPreview`):
        // while modally shown via showModal(), the SAME inline override
        // would just as forcefully fight the UA's own `dialog:modal`
        // top-layer centering (`position: fixed`) — an inline style always
        // outranks any stylesheet rule for the same property regardless of
        // origin — corrupting the real native modal's own presentation.
        // Every Preview mount of this component already IS a showModal()
        // case by construction (see this file's own top comment), so
        // `isPreview` alone is sufficient to distinguish the two.
        ...(!isPreview ? { position: "static" as const } : {}),
        // Checkpoint 1.15.6.9.1 — the companion fix to the `position`
        // override just above, but for the opposite direction: Tailwind's
        // own Preflight resets `margin: 0` on literally every element
        // (`*, ::before, ::after, ::backdrop` — confirmed live via this
        // checkpoint's own QA by inspecting the actual parsed `@layer
        // base` rule, not assumed), which is an AUTHOR-origin rule and so
        // unconditionally wins over the UA's own `dialog:modal { margin:
        // auto }` centering rule regardless of specificity — origin beats
        // specificity in the cascade, so no amount of removing our OWN
        // classes could ever "lose" to the UA rule on purpose (this file
        // briefly tried a Design-only `m-0` utility class for the
        // Design-mode side of this same conflict; it turned out to be
        // entirely redundant with Preflight's own reset and was removed).
        // Explicitly restoring `margin: auto` only while Preview's real
        // showModal() is active reclaims the browser's own centering
        // trick (inset: 0 + margin: auto + a fit-content intrinsic width,
        // all still supplied by the UA `dialog`/`dialog:modal` rules,
        // none of which this component overrides) without touching
        // Design at all, where Preflight's margin: 0 is exactly the
        // ordinary-flow-participation behavior Part 7/8 already wants.
        ...(isPreview && !hasExplicitPosition ? { margin: "auto" as const } : {}),
        // Checkpoint 1.15.6.11.3 — a real, live-QA-caught finding: Position
        // (Checkpoint 5.1) is unconditional for every OTHER element
        // (ContainerElement etc. always spread resolvePositionStyle
        // regardless of Design/Preview), and initially this component did
        // the same. That is exactly correct for an ordinary box, but not
        // here: Dialog already has its own bespoke Design-mode positioning
        // story distinct from every other tag (the `position: static`
        // override immediately above exists solely because Design must
        // never let this box escape ordinary flow) — Part 16 of this
        // checkpoint's own brief explicitly says Design showing the Dialog
        // as ordinary inline/non-modal content, while only Preview uses the
        // real top-layer/edge-anchored presentation, is an already-accepted
        // difference, not something to make WYSIWYG-perfect. Confirmed live
        // during this checkpoint's own QA that spreading an authored
        // `position: fixed; inset: 0 auto 0 0` unconditionally (matching
        // every other element) makes a real Drawer's own Dialog float fixed
        // over the ENTIRE viewport in Design too — physically covering the
        // app's own toolbar chrome, making it unclickable. Gating this
        // resolver's own spread on `isPreview` keeps Design's dialog exactly
        // where the `position: static` restoration above already puts it —
        // an ordinary, fully editable, in-flow box — and defers the
        // authored Position entirely to Preview, the only mode where a
        // Dialog's own CSS position is ever actually meaningful (native
        // top-layer promotion). Generic to Dialog, not Drawer: any future
        // composition that authors Position on a Dialog gets the same
        // Design-safe behavior with no per-composition code.
        ...(isPreview ? resolvePositionStyle(node) : {}),
        ...elementPositionStyle(node, parentLayoutMode),
        ...(isPreview && hasExplicitPosition ? { height: "auto" as const } : {}),
        ...resolveAspectRatioStyle(node),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveTransitionStyle(node, isPreview),
      }}
      {...listeners}
    >
      {children}
    </dialog>
  );
}
