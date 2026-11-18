"use client";

import { sharedExplanation, type SharedValue } from "@/features/inspector/types/sharedValue";

/**
 * BC-10.3: one 11px help line under a multi-selection segmented row (which
 * has no placeholder) when its effective value is unknown, or shared but
 * not one of the row's options. Renders nothing for "same" and "mixed"
 * (Mixed already shows as no active option plus the mixed state dot).
 */
export function InspectorSharedValueNote<T>({ shared }: { shared: SharedValue<T> }) {
  const text = sharedExplanation(shared);
  if (!text) return null;
  return <p className="px-0.5 text-[11px] text-fg-secondary">{text}</p>;
}
