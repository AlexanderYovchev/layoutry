"use client";

import { useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { Dialog } from "@/components/ui/Dialog";
import {
  dialogFooterClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/project/components/projectDialogButtons";
import { normalizeProjectName } from "@/features/project/rules/projectName";
import type { ProjectNamePurpose } from "@/features/project/stores/useProjectDialogStore";

const COPY: Record<
  ProjectNamePurpose,
  { title: string; submit: string; hint: string }
> = {
  "first-save": {
    title: "Save Project",
    submit: "Save",
    hint: "The project is saved in this browser's local project library.",
  },
  "save-as": {
    title: "Save As",
    submit: "Save As",
    hint: "Saves a separate copy. The original project stays as it was last saved.",
  },
  rename: {
    title: "Rename Project",
    submit: "Rename",
    hint: "The new name is kept when you next save the project.",
  },
};

interface ProjectNameDialogProps {
  purpose: ProjectNamePurpose | null;
  initialName: string;
  onSubmit: (purpose: ProjectNamePurpose, name: string) => void;
  onClose: () => void;
}

export function ProjectNameDialog({
  purpose,
  initialName,
  onSubmit,
  onClose,
}: ProjectNameDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog
      open={purpose !== null}
      onClose={onClose}
      title={purpose ? COPY[purpose].title : ""}
      initialFocusRef={inputRef}
    >
      {purpose && (
        <ProjectNameForm
          key={purpose}
          purpose={purpose}
          initialName={initialName}
          inputRef={inputRef}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      )}
    </Dialog>
  );
}

interface ProjectNameFormProps {
  purpose: ProjectNamePurpose;
  initialName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (purpose: ProjectNamePurpose, name: string) => void;
  onCancel: () => void;
}

function ProjectNameForm({
  purpose,
  initialName,
  inputRef,
  onSubmit,
  onCancel,
}: ProjectNameFormProps) {
  const [value, setValue] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const messageId = useId();
  const copy = COPY[purpose];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = normalizeProjectName(value);
    if (!result.ok) {
      setError(result.message);
      inputRef.current?.focus();
      return;
    }
    onSubmit(purpose, result.name);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label
        htmlFor={inputId}
        className="text-fg-primary mb-1.5 block text-xs font-medium"
      >
        Project name
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onFocus={(event) => event.currentTarget.select()}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error !== null}
        aria-describedby={messageId}
        className="rounded-control border-line bg-surface-panel text-fg-primary focus-visible:outline-accent h-9 w-full border px-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 aria-invalid:border-red-500"
      />
      <p
        id={messageId}
        role={error ? "alert" : undefined}
        className={
          error
            ? "mt-1.5 text-xs text-red-600 dark:text-red-400"
            : "text-fg-secondary mt-1.5 text-xs"
        }
      >
        {error ?? copy.hint}
      </p>
      <div className={dialogFooterClass}>
        <button
          type="button"
          onClick={onCancel}
          className={secondaryButtonClass}
        >
          Cancel
        </button>
        <button type="submit" className={primaryButtonClass}>
          {copy.submit}
        </button>
      </div>
    </form>
  );
}
