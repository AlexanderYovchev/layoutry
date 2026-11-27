"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  compileDocumentSheet,
  DocumentStyleCompiler,
  type LiveGestureView,
} from "@/features/canvas/styling/documentStyleCompiler";
import { StyleSheetHost } from "@/features/canvas/utils/styleSheetHost";
import {
  selectActiveLiveGesture,
  useEditorStore,
  type LiveGestureState,
} from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

/*
 * BC-17.3 — installs the shared generated stylesheet for the document
 * surface (Design or Preview) and keeps it in sync with the store.
 *
 * Ordering contract (Report 1 §8.11): the sheet is updated from a direct
 * store subscription, synchronously inside the very store write — BEFORE
 * React re-renders the elements. So when a gesture commits, the committed
 * geometry is already in the sheet when the element drops its inline
 * override, and no painted frame is ever missing geometry. The first
 * install runs in a layout effect, before the first paint.
 *
 * Each mounted surface owns its own <style> element and scope token
 * (data-ly-sheet), so a Design sheet can never style Preview, another
 * surface or editor chrome. The <style> is rendered by the surface itself
 * (React owns it, so nothing can drop it from the page, as happened to a
 * node injected into <head> during hydration); the host only fills it
 * through the CSSOM. The scope comes from useId, so the server-rendered
 * and the hydrated attribute are always the same token.
 */

const committedIndexes = new WeakMap<
  EditorElementNode,
  Map<string, EditorElementNode>
>();

function committedIndex(
  document: EditorElementNode,
): Map<string, EditorElementNode> {
  let index = committedIndexes.get(document);
  if (!index) {
    index = new Map();
    const stack = [document];
    while (stack.length > 0) {
      const node = stack.pop()!;
      index.set(node.id, node);
      if (node.children) stack.push(...node.children);
    }
    committedIndexes.set(document, index);
  }
  return index;
}

const views = new WeakMap<LiveGestureState, LiveGestureView>();

function liveView(
  gesture: LiveGestureState | null,
): LiveGestureView | undefined {
  if (!gesture) return undefined;
  let view = views.get(gesture);
  if (!view) {
    const ids = new Set(Object.keys(gesture.slices));
    const snapshotDocument = gesture.snapshot.document;
    view = {
      nodeIds: ids,
      committedNode: (id) => committedIndex(snapshotDocument).get(id),
    };
    views.set(gesture, view);
  }
  return view;
}

const DEVELOPMENT = process.env.NODE_ENV !== "production";

export interface DocumentStyleSheet {
  /** The surface's data-ly-sheet token. */
  scope: string;
  surface: "design" | "preview";
  /** Attach to the surface's own <style> element. */
  styleRef: RefObject<HTMLStyleElement | null>;
  /**
   * The sheet for the document as first rendered, as the <style>'s text: it
   * is server-rendered, so the page is styled from first paint, before
   * hydration runs the host (without it the document painted unstyled for
   * the ~0.6 s until hydration). It never changes afterwards — React must
   * never rewrite the text, which would make the browser re-parse the sheet
   * and drop the host's CSSOM edits; the host clears and owns the rules.
   */
  initialCss: string;
}

/** Fills the surface's generated document sheet and keeps it in sync with the store. */
export function useDocumentStyleSheet(): DocumentStyleSheet {
  // useId is unique per mounted surface and identical on the server and the client.
  const scope = `s${useId()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}`;
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const surface = isPreview ? "preview" : "design";
  // The compiler is deterministic, so the server's and the hydrating client's text are identical.
  const [initialCss] = useState(() =>
    compileDocumentSheet(useEditorStore.getState().document, surface, scope),
  );

  useLayoutEffect(() => {
    const element = styleRef.current;
    if (!element) return;
    const host = new StyleSheetHost(element, surface, scope);
    const compiler = new DocumentStyleCompiler(surface, scope);
    const sync = (
      document: EditorElementNode,
      gesture: LiveGestureState | null,
    ) => {
      const change = compiler.update(document, liveView(gesture));
      host.apply(change);
      // Development: report the compile errors of what just changed (not the whole document again).
      if (DEVELOPMENT)
        for (const id of change.changed.keys())
          for (const diagnostic of compiler.irOf(id)?.diagnostics ?? [])
            if (diagnostic.severity === "error")
              console.error(
                `[Layoutry stylesheet] ${diagnostic.message}`,
                diagnostic,
              );
    };
    const initial = useEditorStore.getState();
    sync(initial.document, selectActiveLiveGesture(initial));
    let lastDocument = initial.document;
    let lastGesture = selectActiveLiveGesture(initial);
    const unsubscribe = useEditorStore.subscribe((state) => {
      const gesture = selectActiveLiveGesture(state);
      if (state.document === lastDocument && gesture === lastGesture) return;
      const ended = lastGesture !== null && gesture === null;
      lastDocument = state.document;
      lastGesture = gesture;
      sync(state.document, gesture);
      // Development assertion: once a gesture has ended, no element may keep a live override.
      if (DEVELOPMENT && ended)
        requestAnimationFrame(() => {
          const leaked = globalThis.document.querySelectorAll(
            `[data-ly-sheet="${scope}"] [data-ly-gesture-override]`,
          );
          if (
            leaked.length > 0 &&
            selectActiveLiveGesture(useEditorStore.getState()) === null
          )
            console.error(
              `[Layoutry stylesheet] ${leaked.length} element(s) kept a live gesture override after the gesture ended.`,
            );
        });
    });
    return () => {
      unsubscribe();
      host.dispose();
    };
  }, [surface, scope]);

  return { scope, surface, styleRef, initialCss };
}
