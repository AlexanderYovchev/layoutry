import type { CounterDefinition } from "@/features/editor/types/counters";
import type {
  StyleRule,
  StyleRuleGroups,
} from "@/features/editor/types/styleRules";

/**
 * BC-17.2 — document-level styling assets (BC-17.1.3 Report 1 §4.5). They
 * live on the document root (the "page" node) so they travel with the
 * file and are part of every Undo/Redo snapshot. One asset system for all
 * components: keyframes (motion, BC-17.11), counters (P-4) and the project
 * preset library (BC-17.23). Only the foundational representation exists
 * now; authoring, application and management come with their checkpoints.
 */

export interface KeyframeStop {
  /** Percent of the animation, 0–100; unique within a definition. */
  offset: number;
  groups: StyleRuleGroups;
}

export interface KeyframesDefinition {
  id: string;
  /** Display name; unique per document after normalizeAssetName. */
  name: string;
  stops: KeyframeStop[];
}

export const PRESET_KINDS = [
  "typography",
  "category",
  "element",
  "component",
  "state",
  "motion",
] as const;
export type PresetKind = (typeof PRESET_KINDS)[number];

/** What a preset carries (the clipboard payload v2 shape, Report 1 §14–§15). */
export interface PresetPayload {
  groups?: StyleRuleGroups;
  rules?: StyleRule[];
  keyframes?: KeyframesDefinition[];
  counters?: CounterDefinition[];
}

/**
 * A preset stored in a project ("project" library). The same shape is
 * used by the built-in and app libraries (BC-17.23), which never live in a
 * project file. Application is detached: nothing ever references a preset.
 */
export interface PresetDefinition {
  id: string;
  library: "project";
  name: string;
  kind: PresetKind;
  payload: PresetPayload;
  createdAt: string;
  updatedAt: string;
}

export interface StyleAssets {
  keyframes?: KeyframesDefinition[];
  counters?: CounterDefinition[];
  presets?: PresetDefinition[];
}

// Security bounds for untrusted files (Report 1 §17), not UX caps.
export const MAX_KEYFRAMES_DEFINITIONS = 1_024;
export const MAX_KEYFRAME_STOPS = 64;
export const MAX_PRESETS_PER_LIBRARY = 2_048;
export const MAX_ASSET_NAME_LENGTH = 64;

/**
 * The comparison form of an asset name (N8.4 clarification, Report 1
 * §15.5): Unicode NFC, trimmed, inner whitespace collapsed, case-folded.
 * Names equal in this form are the same name within one library.
 */
export function normalizeAssetName(name: string): string {
  return name
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("und");
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;

export function isValidAssetName(name: string): boolean {
  const normalized = normalizeAssetName(name);
  return (
    normalized.length >= 1 &&
    normalized.length <= MAX_ASSET_NAME_LENGTH &&
    !CONTROL_CHARACTERS.test(name)
  );
}
