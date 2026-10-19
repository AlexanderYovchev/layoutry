"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getInputType, INPUT_TYPES, isToggleInputType, type InputType } from "@/features/editor/types/input";
import type { EditorElementNode } from "@/features/editor/types/document";
import { cn } from "@/lib/utils";
import { inspectorFieldClassName } from "@/features/inspector/components/inspectorFieldClassName";

const INPUT_TYPE_OPTION_LABELS: Record<InputType, string> = {
  text: "Text",
  email: "Email",
  password: "Password",
  number: "Number",
  search: "Search",
  url: "URL",
  tel: "Tel",
  checkbox: "Checkbox",
  radio: "Radio",
};

interface InputTypeFieldProps {
  value: InputType;
  onChange: (value: InputType) => void;
}

/**
 * A native `<select>` dropdown for Input Type (Checkpoint 1.11, widened
 * to checkbox/radio in 1.12) — this many textual options is past the
 * point a segmented row (InspectorSegmentedRow, used for Heading
 * Level's six single-character H1–H6 options) stays legible in this
 * panel's own width; InspectorUnitSelect already established the
 * "several textual choices -> a real <select>" pattern this mirrors,
 * just not extracted as a shared component since that one is
 * CssUnit-typed and this checkpoint has exactly one consumer. Always
 * has a value (no "unset" state — every Input has an effective type via
 * getInputType's own text default), so this never needs the Reset
 * affordance the other three fields use. Deliberately offers every
 * InputType, including checkbox/radio — switching directly between any
 * two families (e.g. Email -> Checkbox -> Radio -> Text) is the whole
 * point of one shared Input node, not something this control should
 * artificially restrict.
 */
function InputTypeField({ value, onChange }: InputTypeFieldProps) {
  return (
    <InspectorPropertyRow label="Type" labelHtmlFor="form-control-input-type">
      <select
        id="form-control-input-type"
        value={value}
        onChange={(event) => onChange(event.target.value as InputType)}
        className={cn(
          inspectorFieldClassName,
          "w-full px-1",
        )}
      >
        {INPUT_TYPES.map((type) => (
          <option key={type} value={type}>
            {INPUT_TYPE_OPTION_LABELS[type]}
          </option>
        ))}
      </select>
    </InspectorPropertyRow>
  );
}

interface InspectorFormControlSectionProps {
  /** The selected node — rendered only for a form-control-capable tag (see InspectorNodeSummary, gated on getElementCapabilities().supportsFormControl — Checkpoint 1.10). */
  node: EditorElementNode;
}

interface FormControlTextFieldProps {
  id: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  onReset: () => void;
  hasExplicitValue: boolean;
}

/**
 * A plain draft/commit/Escape-revert text field — the same shape
 * InspectorLinkSection's own LinkDestinationField already established
 * (see that component's own doc comment for the two bug-fix details,
 * `touched` and `suppressNextBlurCommitRef`, both reused unchanged here).
 * A second, independent, intentionally-not-yet-shared copy rather than an
 * early abstraction — this checkpoint has three near-identical consumers
 * within this one file, not a cross-file need. An empty draft on blur/
 * Enter reverts rather than committing, exactly like Link's destination
 * field; Reset is the only clear affordance.
 */
function FormControlTextField({ id, label, value, onCommit, onReset, hasExplicitValue }: FormControlTextFieldProps) {
  const [draft, setDraft] = useState(value);
  const [touched, setTouched] = useState(false);
  const suppressNextBlurCommitRef = useRef(false);
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(value);
    setTouched(false);
  }

  function commit() {
    if (!touched) return;
    setTouched(false);
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(value);
      return;
    }
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
      event.preventDefault();
      setDraft(value);
      setTouched(false);
      suppressNextBlurCommitRef.current = true;
      event.currentTarget.blur();
    }
  }

  return (
    <InspectorPropertyRow
      label={label}
      labelHtmlFor={id}
      variant="stack"
      state={hasExplicitValue ? "set" : "unset"}
      reset={<InspectorResetButton onReset={onReset} disabled={!hasExplicitValue} label={`Reset ${label.toLowerCase()}`} />}
    >
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setTouched(true);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          inspectorFieldClassName,
          "w-full px-2",
        )}
      />
    </InspectorPropertyRow>
  );
}

/**
 * Form Control's semantic concerns, type-aware since Checkpoint 1.12:
 * Type (Checkpoint 1.11 — only for `input`; Textarea has no inputType
 * concept at all, so this row is omitted entirely for it, not just
 * disabled), Name, Placeholder, and Default Value (Checkpoint 1.10),
 * and Checked (Checkpoint 1.12 — only for checkbox/radio, replacing
 * Placeholder, which native checkbox/radio ignore entirely and would
 * only confuse the panel). Deliberately not a CSS Inspector section,
 * the same "element data, not styling" spirit InspectorLinkSection/
 * InspectorHeadingLevelSection already established, placed in the same
 * position (after Link/Heading Level, before Typography). Type renders
 * first when present — it's the field that determines what the others
 * even mean. required/disabled/readonly/min/max/pattern/autocomplete
 * remain deliberately out of this checkpoint's scope — see this
 * checkpoint's own report. One completed edit is one history entry per
 * field (setElementInputType/setElementName/setElementPlaceholder/
 * setElementValue/setElementChecked's own one-shot, action-level-no-op-
 * guarded store actions); an unchanged value never commits at all.
 *
 * Switching Type never deletes Placeholder/Checked even when the newly
 * selected type hides one of them from view — see this checkpoint's
 * report on non-destructive type transitions. Hiding here is purely a
 * rendering decision; the underlying document field is untouched.
 *
 * Select (Checkpoint 1.13) is the most restricted case: only Name
 * renders for it — Type has no meaning (no inputType concept), and both
 * Placeholder and Default Value are hidden (a select's own "value" is
 * really "which Option is selected," which has its own dedicated
 * Option Inspector section and setSelectSelectedOption command instead
 * of overloading this generic Default Value field).
 */
export function InspectorFormControlSection({ node }: InspectorFormControlSectionProps) {
  const setElementInputType = useEditorStore((state) => state.setElementInputType);
  const setElementName = useEditorStore((state) => state.setElementName);
  const setElementPlaceholder = useEditorStore((state) => state.setElementPlaceholder);
  const setElementValue = useEditorStore((state) => state.setElementValue);
  const setElementChecked = useEditorStore((state) => state.setElementChecked);

  const isInput = node.tag === "input";
  const isSelect = node.tag === "select";
  const isToggle = isInput && isToggleInputType(getInputType(node));

  return (
    <InspectorSection label="Form Control" defaultOpen>
      {isInput && <InputTypeField value={getInputType(node)} onChange={(inputType) => setElementInputType(node.id, inputType)} />}
      <FormControlTextField
        id="form-control-name"
        label="Name"
        value={node.name ?? ""}
        hasExplicitValue={node.name !== undefined}
        onCommit={(value) => setElementName(node.id, value)}
        onReset={() => setElementName(node.id, undefined)}
      />
      {!isToggle && !isSelect && (
        <FormControlTextField
          id="form-control-placeholder"
          label="Placeholder"
          value={node.placeholder ?? ""}
          hasExplicitValue={node.placeholder !== undefined}
          onCommit={(value) => setElementPlaceholder(node.id, value)}
          onReset={() => setElementPlaceholder(node.id, undefined)}
        />
      )}
      {!isSelect && (
        <FormControlTextField
          id="form-control-value"
          label="Default Value"
          value={node.value ?? ""}
          hasExplicitValue={node.value !== undefined}
          onCommit={(value) => setElementValue(node.id, value)}
          onReset={() => setElementValue(node.id, undefined)}
        />
      )}
      {isToggle && (
        <InspectorPropertyRow label="Checked">
          <InspectorBooleanToggle checked={node.checked ?? false} onChange={(checked) => setElementChecked(node.id, checked)} label="Checked" />
        </InspectorPropertyRow>
      )}
    </InspectorSection>
  );
}
