"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { InspectorBackgroundPositionGrid } from "@/features/inspector/components/InspectorBackgroundPositionGrid";
import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  getBackgroundSettings,
  isValidBackgroundImageUrl,
  isValidBackgroundSizeValue,
  withBackgroundField,
  withBackgroundSize,
  type BackgroundAttachment,
  type BackgroundCustomSize,
  type BackgroundPosition,
  type BackgroundRepeat,
  type BackgroundSettings,
  type BackgroundSizeAxisValue,
  type BackgroundSizeMode,
} from "@/features/editor/types/background";
import type { CssUnit } from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";
import { cn } from "@/lib/utils";

interface InspectorBackgroundImageControlsProps {
  node: EditorElementNode;
}

/** Matches no real option — same "don't falsely highlight an unset property" convention InspectorTypographySection established for Weight/Style/Align. */
const NO_ACTIVE_OPTION = "";

const CUSTOM_SIZE_UNITS: readonly CssUnit[] = ["px", "%", "rem", "em"];
const DEFAULT_CUSTOM_SIZE: BackgroundCustomSize = { width: "auto", height: "auto" };

const SIZE_OPTIONS = ["Auto", "Cover", "Contain", "Custom"];
const SIZE_LABEL_TO_VALUE: Record<string, BackgroundSizeMode> = { Auto: "auto", Cover: "cover", Contain: "contain", Custom: "custom" };
const SIZE_VALUE_TO_LABEL: Record<BackgroundSizeMode, string> = { auto: "Auto", cover: "Cover", contain: "Contain", custom: "Custom" };

const REPEAT_OPTIONS = ["No Repeat", "Repeat", "Repeat X", "Repeat Y", "Space", "Round"];
const REPEAT_LABEL_TO_VALUE: Record<string, BackgroundRepeat> = {
  "No Repeat": "no-repeat",
  Repeat: "repeat",
  "Repeat X": "repeat-x",
  "Repeat Y": "repeat-y",
  Space: "space",
  Round: "round",
};
const REPEAT_VALUE_TO_LABEL: Record<BackgroundRepeat, string> = {
  "no-repeat": "No Repeat",
  repeat: "Repeat",
  "repeat-x": "Repeat X",
  "repeat-y": "Repeat Y",
  space: "Space",
  round: "Round",
};

const ATTACHMENT_OPTIONS = ["Scroll", "Fixed", "Local"];
const ATTACHMENT_LABEL_TO_VALUE: Record<string, BackgroundAttachment> = { Scroll: "scroll", Fixed: "fixed", Local: "local" };
const ATTACHMENT_VALUE_TO_LABEL: Record<BackgroundAttachment, string> = { scroll: "Scroll", fixed: "Fixed", local: "Local" };

interface BackgroundImageUrlFieldProps {
  value: string | undefined;
  onCommit: (value: string) => void;
  error?: string;
}

/**
 * A draft/commit/Escape-revert URL text field (Checkpoint 1.15.1 fix) —
 * still not extracted as a shared primitive (this is its only consumer;
 * see this project's "don't extract until genuinely shared" rule and
 * InspectorMediaTextField's own doc comment for why THAT component's
 * different empty-behavior makes it not a fit here either), but now built
 * on the exact same two proven bug fixes InspectorMediaTextField/
 * LinkDestinationField already use — this component previously predated
 * both and was missing them:
 *
 * 1. `touched`, set only by a real onChange and cleared on every
 *    resync/commit — without it, blurring the field with no edit at all
 *    (tabbing through it, or clicking it then clicking away) still called
 *    onCommit with the value it already had, pushing a spurious history
 *    entry through setElementBackground's own store action (which — unlike
 *    the newer one-field document commands — pushes history unconditionally
 *    on every call; see backgroundCommands.ts's own setBackgroundSettings,
 *    which always returns a new object reference since withBackgroundField
 *    always spreads a fresh one, so there is no cheap reference-equality
 *    no-op guard available at that layer the way setElementSrc/setElementHref
 *    have — this checkpoint's own report documents this as a known,
 *    deferred characteristic of the whole Background CSS write path, out of
 *    scope beyond this specifically-reported field).
 * 2. `suppressNextBlurCommitRef` — Enter calls event.currentTarget.blur()
 *    to visually release focus, which fires a real native blur event that
 *    this field's own onBlur would otherwise treat as an unrelated second
 *    commit of the identical already-committed draft, doubling the
 *    history entry for one keypress.
 *
 * An empty draft on blur/Enter still reverts rather than committing —
 * Reset is the only clear affordance, unchanged from before.
 */
function BackgroundImageUrlField({ value, onCommit, error }: BackgroundImageUrlFieldProps) {
  const [draft, setDraft] = useState(value ?? "");
  const [touched, setTouched] = useState(false);
  const suppressNextBlurCommitRef = useRef(false);
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(value ?? "");
    setTouched(false);
  }

  function commit() {
    if (!touched) return;
    setTouched(false);
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(value ?? "");
      return;
    }
    // Guards the "unchanged value = no history" requirement at this call
    // site specifically — see this function's own doc comment for why
    // setElementBackground itself can't cheaply provide this no-op check
    // the way setElementSrc/setElementHref do.
    if (trimmed === value) return;
    onCommit(trimmed);
  }

  function handleBlur() {
    if (suppressNextBlurCommitRef.current) {
      suppressNextBlurCommitRef.current = false;
      return;
    }
    commit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit();
      suppressNextBlurCommitRef.current = true;
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(value ?? "");
      setTouched(false);
      suppressNextBlurCommitRef.current = true;
      event.currentTarget.blur();
    }
  }

  return (
    <input
      id="background-image-url"
      type="text"
      aria-label="Background image URL"
      aria-invalid={error ? true : undefined}
      value={draft}
      placeholder="https://example.com/image.jpg"
      onChange={(event) => {
        setDraft(event.target.value);
        setTouched(true);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-6 w-full rounded-md border bg-zinc-50 px-2 text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:bg-zinc-900 dark:text-zinc-300",
        error ? "border-red-400 dark:border-red-600" : "border-zinc-200 dark:border-zinc-800",
      )}
    />
  );
}

/**
 * The Image-source controls (Checkpoint 4.3, extracted from
 * InspectorBackgroundSection in 4.3.1 once a Gradient source needed its
 * own equally-sized sibling block — see InspectorGradientSection).
 * Rendered only while Image is the selected Background source (see
 * InspectorBackgroundSection); everything below is otherwise unchanged
 * from Checkpoint 4.3. Size/Position/Repeat/Attachment stay
 * image-URL-dependent (Checkpoint 4.3's own #9) — dimmed and functionally
 * disabled until a URL is actually set, independent of the higher-level
 * "is Image even the active source" concern this component's parent
 * now owns.
 */
export function InspectorBackgroundImageControls({ node }: InspectorBackgroundImageControlsProps) {
  const setElementBackground = useEditorStore((state) => state.setElementBackground);
  const background = getBackgroundSettings(node);
  const hasImage = Boolean(background.image);

  const [imageError, setImageError] = useState<string | undefined>(undefined);
  const [widthError, setWidthError] = useState<string | undefined>(undefined);
  const [heightError, setHeightError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setImageError(undefined);
    setWidthError(undefined);
    setHeightError(undefined);
  }

  function commitField<K extends Exclude<keyof BackgroundSettings, "size" | "customSize" | "gradient">>(
    field: K,
    value: BackgroundSettings[K],
  ) {
    setElementBackground(node.id, withBackgroundField(background, field, value));
  }

  function resetField(field: Exclude<keyof BackgroundSettings, "size" | "customSize" | "gradient">) {
    setElementBackground(node.id, withBackgroundField(background, field, undefined));
  }

  function handleImageCommit(text: string) {
    if (!isValidBackgroundImageUrl(text)) {
      setImageError("Enter a valid image URL or path.");
      return;
    }
    setImageError(undefined);
    commitField("image", text);
  }

  function handleSizeSelect(option: string) {
    const mode = SIZE_LABEL_TO_VALUE[option];
    setElementBackground(
      node.id,
      withBackgroundSize(background, mode, mode === "custom" ? background.customSize ?? DEFAULT_CUSTOM_SIZE : undefined),
    );
  }

  function resetSize() {
    setWidthError(undefined);
    setHeightError(undefined);
    setElementBackground(node.id, withBackgroundSize(background, undefined));
  }

  function commitSizeAxis(axis: "width" | "height", next: NumericOrAuto, setError: (message: string | undefined) => void) {
    const current = background.customSize ?? DEFAULT_CUSTOM_SIZE;
    if (next === "auto") {
      setError(undefined);
      setElementBackground(node.id, withBackgroundSize(background, "custom", { ...current, [axis]: "auto" }));
      return;
    }
    if (!isValidBackgroundSizeValue(next)) {
      setError(`Enter a ${axis} greater than 0.`);
      return;
    }
    setError(undefined);
    const currentAxis = current[axis];
    const unit = currentAxis !== "auto" ? currentAxis.unit : "px";
    setElementBackground(node.id, withBackgroundSize(background, "custom", { ...current, [axis]: { value: next, unit } }));
  }

  function changeSizeAxisUnit(axis: "width" | "height", unit: CssUnit) {
    const current = background.customSize ?? DEFAULT_CUSTOM_SIZE;
    const currentAxis = current[axis];
    if (currentAxis === "auto") return;
    setElementBackground(node.id, withBackgroundSize(background, "custom", { ...current, [axis]: { value: currentAxis.value, unit } }));
  }

  function axisValue(axis: BackgroundSizeAxisValue): NumericOrAuto {
    return axis === "auto" ? "auto" : axis.value;
  }
  function axisUnit(axis: BackgroundSizeAxisValue): CssUnit {
    return axis === "auto" ? "px" : axis.unit;
  }

  const customSize = background.customSize ?? DEFAULT_CUSTOM_SIZE;

  return (
    <>
      <InspectorPropertyRow
        label="Image"
        labelHtmlFor="background-image-url"
        variant="stack"
        state={imageError ? "invalid" : hasImage ? "set" : "unset"}
        error={imageError}
        reset={<InspectorResetButton onReset={() => { setImageError(undefined); resetField("image"); }} disabled={!hasImage} label="Reset background image" />}
      >
        <BackgroundImageUrlField value={background.image} onCommit={handleImageCommit} error={imageError} />
      </InspectorPropertyRow>

      {!hasImage && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          Set an image above to enable size, position, repeat, and attachment.
        </p>
      )}

      {/*
       * Dims visually (opacity-50) without pointer-events-none: each
       * option button below is already genuinely `disabled` (a real HTML
       * attribute, not just this wrapper's opacity) once !hasImage, so
       * selecting a new value is already blocked at the control itself.
       * pointer-events-none on this wrapper would ALSO swallow clicks on
       * each row's Reset button — whose own `disabled` is tied to
       * whether that field still holds a stale explicit value, not to
       * hasImage — so a value set before the image was removed could
       * never be cleared again without re-adding an image first. Reset
       * must stay independently functional regardless of order.
       */}
      <div className={cn("flex flex-col gap-1.5", !hasImage && "opacity-50")}>
        <InspectorSegmentedRow
          label="Size"
          help="Controls how the image fills the element."
          disabled={!hasImage}
          state={hasImage ? (background.size ? "set" : "unset") : "not-applicable"}
          options={SIZE_OPTIONS}
          activeOption={background.size ? SIZE_VALUE_TO_LABEL[background.size] : NO_ACTIVE_OPTION}
          onSelect={handleSizeSelect}
          reset={<InspectorResetButton onReset={resetSize} disabled={!background.size} label="Reset background size" />}
        />

        {background.size === "custom" && (
          <div className="flex flex-col gap-1.5 pl-2">
            <InspectorPropertyRow label="Width" variant="stack" error={widthError} disabled={!hasImage}>
              <InspectorNumericValueControl
                ariaLabel="Width"
                value={axisValue(customSize.width)}
                allowAuto
                unit={axisUnit(customSize.width)}
                allowedUnits={CUSTOM_SIZE_UNITS}
                onUnitChange={(unit) => changeSizeAxisUnit("width", unit)}
                onCommit={(next) => commitSizeAxis("width", next, setWidthError)}
                disabled={!hasImage}
              />
            </InspectorPropertyRow>
            <InspectorPropertyRow label="Height" variant="stack" error={heightError} disabled={!hasImage}>
              <InspectorNumericValueControl
                ariaLabel="Height"
                value={axisValue(customSize.height)}
                allowAuto
                unit={axisUnit(customSize.height)}
                allowedUnits={CUSTOM_SIZE_UNITS}
                onUnitChange={(unit) => changeSizeAxisUnit("height", unit)}
                onCommit={(next) => commitSizeAxis("height", next, setHeightError)}
                disabled={!hasImage}
              />
            </InspectorPropertyRow>
          </div>
        )}

        <InspectorBackgroundPositionGrid
          value={background.position}
          disabled={!hasImage}
          state={hasImage ? (background.position ? "set" : "unset") : "not-applicable"}
          onSelect={(position: BackgroundPosition) => commitField("position", position)}
          reset={<InspectorResetButton onReset={() => resetField("position")} disabled={!background.position} label="Reset background position" />}
        />

        <InspectorSegmentedRow
          label="Repeat"
          help="Controls whether the image tiles when it does not fill the area."
          disabled={!hasImage}
          state={hasImage ? (background.repeat ? "set" : "unset") : "not-applicable"}
          options={REPEAT_OPTIONS}
          activeOption={background.repeat ? REPEAT_VALUE_TO_LABEL[background.repeat] : NO_ACTIVE_OPTION}
          onSelect={(option) => commitField("repeat", REPEAT_LABEL_TO_VALUE[option])}
          reset={<InspectorResetButton onReset={() => resetField("repeat")} disabled={!background.repeat} label="Reset background repeat" />}
        />

        <InspectorSegmentedRow
          label="Attachment"
          help="Fixed keeps the image still relative to the browser window while the rest of the page scrolls."
          disabled={!hasImage}
          state={hasImage ? (background.attachment ? "set" : "unset") : "not-applicable"}
          options={ATTACHMENT_OPTIONS}
          activeOption={background.attachment ? ATTACHMENT_VALUE_TO_LABEL[background.attachment] : NO_ACTIVE_OPTION}
          onSelect={(option) => commitField("attachment", ATTACHMENT_LABEL_TO_VALUE[option])}
          reset={<InspectorResetButton onReset={() => resetField("attachment")} disabled={!background.attachment} label="Reset background attachment" />}
        />
      </div>
    </>
  );
}
