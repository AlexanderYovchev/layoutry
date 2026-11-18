"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SectionSettingsKey, SectionSettingsValues } from "@/features/editor/commands/sectionSettingsCommands";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

/**
 * BC-10.4: lets a SINGLE-selection Inspector section edit a whole multi-
 * selection. Inside <InspectorSectionFanOut ids>, every setter a section
 * obtains through useFanOutSetter writes its next settings to all `ids`
 * (store.setElementsSettings: all-or-nothing, one Undo step; live writes
 * stay inside the section's own begin/commitTransaction). Outside it,
 * the section's own single-element setter is used, unchanged.
 *
 * Only correct when every element in `ids` has the same authored settings
 * for that section and the same tag (InspectorMultiNodeSummary checks
 * this, see sectionUniformity.ts): then the shown element's values ARE
 * every element's values, and the settings the section computes from it
 * are the right result for all of them.
 */
const FanOutContext = createContext<readonly string[] | null>(null);

export function InspectorSectionFanOut({ ids, children }: { ids: readonly string[]; children: ReactNode }) {
  return <FanOutContext.Provider value={ids}>{children}</FanOutContext.Provider>;
}

/** Whether the section is being shown for a multi-selection (some sections hide single-element-only affordances). */
export function useIsFanOut(): boolean {
  return useContext(FanOutContext) !== null;
}

/**
 * The setter a section uses for one settings key: its own single-element
 * `setter` normally; in a fan-out, the same value written to every
 * selected element. Signature unchanged: (nodeId, value).
 */
export function useFanOutSetter<K extends SectionSettingsKey>(
  key: K,
  setter: (nodeId: string, value: SectionSettingsValues[K]) => void,
  options?: { live?: boolean },
): (nodeId: string, value: SectionSettingsValues[K]) => void {
  const ids = useContext(FanOutContext);
  const setElementsSettings = useEditorStore((state) => state.setElementsSettings);
  if (!ids) return setter;
  return (_nodeId, value) => setElementsSettings(ids, key, value, options);
}
