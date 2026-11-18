import { setBackgroundSettings } from "@/features/editor/commands/backgroundCommands";
import { setBorderRadiusSettings } from "@/features/editor/commands/borderRadiusCommands";
import { setBorderSettings } from "@/features/editor/commands/borderCommands";
import { setBoxShadowSettings } from "@/features/editor/commands/boxShadowCommands";
import { setDisplaySettings } from "@/features/editor/commands/displayCommands";
import { setFilterSettings } from "@/features/editor/commands/filterCommands";
import {
  setFlexChildSettings,
  setFlexContainerSettings,
  setFlowDisplayMode,
  setGridChildSettings,
  setGridContainerSettings,
} from "@/features/editor/commands/flowLayoutCommands";
import { convertToFlowLayout, setChildResizePolicyForNode } from "@/features/editor/commands/layoutCommands";
import { setPositionSettings } from "@/features/editor/commands/positionCommands";
import { setElementMargin, setElementPadding } from "@/features/editor/commands/spacingCommands";
import { setElementTransform } from "@/features/editor/commands/transformCommands";
import { setElementTransition } from "@/features/editor/commands/transitionCommands";
import { setTypographySettings } from "@/features/editor/commands/typographyCommands";
import { getBackgroundSettings, type BackgroundSettings } from "@/features/editor/types/background";
import type { BorderSettings } from "@/features/editor/types/border";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BoxShadowSettings } from "@/features/editor/types/boxShadow";
import type { DisplaySettings } from "@/features/editor/types/display";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FilterSettings } from "@/features/editor/types/filters";
import {
  getGridContainerSettings,
  type FlexChildSettings,
  type FlexContainerSettings,
  type FlowDisplayMode,
  type GridChildSettings,
  type GridContainerSettings,
} from "@/features/editor/types/flowLayout";
import type { ChildResizePolicy } from "@/features/editor/types/layout";
import type { PositionSettings } from "@/features/editor/types/position";
import type { EdgeValues } from "@/features/editor/types/spacing";
import type { TransformSettings } from "@/features/editor/types/transform";
import type { TransitionSettings } from "@/features/editor/types/transition";
import type { TypographySettings } from "@/features/editor/types/typography";
import { clampGridChildPlacement } from "@/features/editor/utils/clampGridChildPlacement";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";

/**
 * Multi-selection fan-out of a single-selection Inspector section's writes
 * (BC-10.4). Every single-selection CSS section writes through one or two
 * whole-settings setters (setElementTypography(id, settings), ...). When
 * every selected element has the SAME authored settings for that section,
 * writing the section's next settings to every element is exactly the
 * edit the user made on the shown one — so the multi-selection Inspector
 * reuses the real single-selection editor and sends its writes here.
 *
 * Each key runs the very command the single-selection setter runs, once
 * per element, so validation, normalization and per-element rules (the
 * grid placement clamp) are identical. The store applies the result as
 * one all-or-nothing, guarded write.
 */
export interface SectionSettingsValues {
  typography: TypographySettings | undefined;
  background: BackgroundSettings | undefined;
  /**
   * Everything in Background except the colour (source type, image, size,
   * position, repeat, attachment, gradient), given as a BackgroundSettings
   * whose `color` is ignored; undefined removes all of it. Each element
   * keeps its own colour (BC-10.4 Mixed image/gradient row).
   */
  backgroundSource: BackgroundSettings | undefined;
  border: BorderSettings | undefined;
  borderRadius: BorderRadiusSettings | undefined;
  boxShadow: BoxShadowSettings | undefined;
  filters: FilterSettings | undefined;
  transform: TransformSettings | undefined;
  transition: TransitionSettings | undefined;
  display: DisplaySettings | undefined;
  position: PositionSettings | undefined;
  margin: EdgeValues | undefined;
  padding: EdgeValues | undefined;
  flexChild: FlexChildSettings | undefined;
  gridChild: GridChildSettings | undefined;
  flexContainer: FlexContainerSettings;
  gridContainer: GridContainerSettings;
  flowDisplay: FlowDisplayMode;
  childResizePolicy: ChildResizePolicy;
  convertToFlow: null;
}

export type SectionSettingsKey = keyof SectionSettingsValues;

type PerNode<K extends SectionSettingsKey> = (root: EditorElementNode, id: string, value: SectionSettingsValues[K]) => EditorElementNode;

const COMMANDS: { [K in SectionSettingsKey]: PerNode<K> } = {
  typography: setTypographySettings,
  background: setBackgroundSettings,
  backgroundSource: (root, id, value) => {
    const node = findNodeById(root, id);
    if (!node) return root;
    const color = getBackgroundSettings(node).color;
    const source: BackgroundSettings = { ...(value ?? {}) };
    delete source.color;
    const next: BackgroundSettings = color === undefined ? source : { ...source, color };
    return setBackgroundSettings(root, id, Object.keys(next).length > 0 ? next : undefined);
  },
  border: setBorderSettings,
  borderRadius: setBorderRadiusSettings,
  boxShadow: setBoxShadowSettings,
  filters: setFilterSettings,
  transform: setElementTransform,
  transition: setElementTransition,
  display: setDisplaySettings,
  position: setPositionSettings,
  margin: setElementMargin,
  padding: setElementPadding,
  flexChild: setFlexChildSettings,
  // The store's single-element setter clamps a grid placement to the
  // parent's tracks; the same clamp, per element (each has its own parent).
  gridChild: (root, id, value) => {
    const parentId = findParentId(root, id);
    const parent = parentId ? findNodeById(root, parentId) : undefined;
    const clamped = value && parent ? clampGridChildPlacement(value, getGridContainerSettings(parent)) : value;
    return setGridChildSettings(root, id, clamped);
  },
  flexContainer: setFlexContainerSettings,
  gridContainer: setGridContainerSettings,
  flowDisplay: setFlowDisplayMode,
  childResizePolicy: setChildResizePolicyForNode,
  convertToFlow: (root, id) => convertToFlowLayout(root, id),
};

/** The section setting `key` written to every element in `ids` (each once, in order). Same root when nothing changed. */
export function applySectionSettings<K extends SectionSettingsKey>(
  root: EditorElementNode,
  ids: readonly string[],
  key: K,
  value: SectionSettingsValues[K],
): EditorElementNode {
  const command: PerNode<K> = COMMANDS[key];
  const targets = [...new Set(ids)];
  let document = root;
  for (const id of targets) document = command(document, id, value);
  // The single-element commands don't detect a no-op; without this, an
  // unchanged write would push an empty Undo step.
  const unchanged = targets.every((id) => JSON.stringify(findNodeById(document, id)) === JSON.stringify(findNodeById(root, id)));
  return unchanged ? root : document;
}
