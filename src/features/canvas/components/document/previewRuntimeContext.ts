"use client";

import { createContext } from "react";
import type { InteractionTarget } from "@/features/editor/utils/interactionTargets";

/**
 * True while this node, or any ancestor, is hidden by a Preview
 * interaction (BC-02.5.1). Preview keeps hidden content mounted, like the
 * exported page, and only stops displaying it; components that own
 * runtime behavior (media playback, a dialog's open state) read this to
 * act on visibility. Always false in Design.
 */
export const RuntimeHiddenContext = createContext(false);

/**
 * The document's interaction targets, by node id (resolveInteractionTargets),
 * computed once per document by the Canvas root. Preview uses it for the
 * same generated target ids and aria-controls references as the export.
 */
export const InteractionTargetsContext = createContext<ReadonlyMap<string, InteractionTarget>>(new Map());
