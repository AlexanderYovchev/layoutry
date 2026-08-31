"use client";

import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A genuine native `<option>` (Checkpoint 1.13) — never independently
 * draggable/resizable/double-click-editable on the Canvas, by design: an
 * `<option>` has no rendered box at all outside an open native `<select>`
 * dropdown, so there is nothing meaningful for a resize handle or a
 * useNativeFormValueEditing-style editing session to attach to (see
 * elementCapabilities.ts's own `option` override, and this checkpoint's
 * report). Structure + the dedicated Option Inspector section are the
 * reliable authoring surfaces instead — node.text is the visible label,
 * edited only through the Inspector via the ordinary, already-generic
 * setElementText (never useEditableText, which needs a real focusable,
 * clickable rendered box to attach its double-click session to).
 *
 * Its own `selected` field is deliberately NEVER rendered as a DOM
 * `selected` attribute here — the parent SelectElement is what derives
 * its own `defaultValue` by reading across all its Option children; see
 * types/select.ts's own doc comment for why mixing the two models would
 * be exactly the inconsistency this checkpoint's brief warned against.
 *
 * typography/background are still resolved (per elementCapabilities.ts's
 * `option` override) since real browsers do genuinely, if inconsistently,
 * respect an option's own color/background-color inside their native
 * dropdown rendering — a documented browser-styling limitation, not
 * something this component can fully control.
 */
export function OptionElement({ node, parentId }: DocumentElementProps) {
  return (
    <option
      value={node.value}
      {...documentNodeAttributes(node, parentId)}
      style={{
        ...resolveTypographyStyle(node),
        ...resolveBackgroundStyle(node),
      }}
    >
      {node.text}
    </option>
  );
}
