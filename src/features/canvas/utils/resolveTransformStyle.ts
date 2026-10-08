import { getTransformSettings } from "@/features/editor/types/transform";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * Pure Canvas resolver for a node's own CSS Transform (Checkpoint
 * 1.15.6.14.3) — unlike resolveTransitionStyle, this is a function of the
 * node ALONE, with no isPreview gating: Transform is static authored CSS
 * (not a runtime/playback concern the way a transition is), so it must
 * render identically in Design and Preview — the approved Policy D from
 * Checkpoint 1.15.6.14.2.1's feasibility audit, reversing the prior
 * audit's Design-suppression default now that the specific geometry
 * collisions have narrow, targeted fixes (see this checkpoint's own
 * report).
 *
 * Emits one traditional composed `transform` CSS property (never
 * individual translate:/rotate:/scale: properties, never a shorthand-vs-
 * longhand conflict risk since this is the only Transform-owning
 * resolver), in a fixed canonical order — translate, then rotate, then
 * scale — regardless of which fields are present, matching this
 * checkpoint's own approved data model. A present translateX OR
 * translateY always emits both arguments to translate() (CSS's own
 * single-argument form only sets the X component), substituting 0 for
 * whichever one is absent.
 */
export function resolveTransformStyle(node: EditorElementNode): CSSProperties {
  const transform = getTransformSettings(node);
  if (!transform) return {};

  const functions: string[] = [];

  if (transform.translateX !== undefined || transform.translateY !== undefined) {
    functions.push(`translate(${transform.translateX ?? 0}px, ${transform.translateY ?? 0}px)`);
  }
  if (transform.rotateDeg !== undefined) {
    functions.push(`rotate(${transform.rotateDeg}deg)`);
  }
  if (transform.scale !== undefined) {
    functions.push(`scale(${transform.scale})`);
  }

  if (functions.length === 0) return {};
  return { transform: functions.join(" ") };
}
