"use client";

import { useMemo, type CSSProperties } from "react";
import {
  documentInnerClass,
  documentNodeClass,
} from "@/features/canvas/styling/documentStyleCompiler";
import { liveGestureOverrideStyle } from "@/features/canvas/styling/liveGestureOverride";
import {
  selectLiveGestureSlice,
  useEditorStore,
} from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";

/*
 * BC-17.3 — what a Canvas element component needs from the shared
 * stylesheet: its generated classes (the sheet holds every authored and
 * default declaration), its authored classes, and — only while a live
 * geometry gesture writes this node — the inline override for that slice.
 * No authored CSS is inline any more.
 */

const RESERVED_CLASS_PREFIX = "ly-";

/**
 * Authored class tokens without the reserved "ly-" prefix, which belongs
 * to generated classes (the export already refuses such tokens); an
 * authored "ly-…" class could otherwise pick up generated rules.
 */
export function authoredClassTokens(
  className: string | undefined,
): string | undefined {
  if (!className) return undefined;
  const tokens = className
    .split(/\s+/)
    .filter(
      (token) => token !== "" && !token.startsWith(RESERVED_CLASS_PREFIX),
    );
  return tokens.length > 0 ? tokens.join(" ") : undefined;
}

export interface NodeStyleProps {
  className: string;
  innerClassName: string;
  authoredClassName: string | undefined;
  /** The live gesture override, or undefined. */
  style: CSSProperties | undefined;
  /** Marks an element painting a live override (the development leak assertion reads it). */
  overrideAttributes: { "data-ly-gesture-override": string } | undefined;
}

export function useNodeStyle(
  node: EditorElementNode,
  parentLayoutMode: ContainerLayoutMode,
  parentFlowDisplay: FlowDisplayMode,
): NodeStyleProps {
  const slice = useEditorStore((state) =>
    selectLiveGestureSlice(state, node.id),
  );
  const style = useMemo(
    () =>
      slice
        ? liveGestureOverrideStyle(
            node,
            { parentLayoutMode, parentFlowDisplay },
            slice,
          )
        : undefined,
    [slice, node, parentLayoutMode, parentFlowDisplay],
  );
  return {
    className: documentNodeClass(node.id),
    innerClassName: documentInnerClass(node.id),
    authoredClassName: authoredClassTokens(node.className),
    style,
    overrideAttributes: slice
      ? { "data-ly-gesture-override": slice }
      : undefined,
  };
}
