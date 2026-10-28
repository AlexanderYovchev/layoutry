"use client";

import { useRef } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { formatProjectDate } from "@/features/project/components/ProjectLibraryDialog";
import {
  dangerButtonClass,
  dialogFooterClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/dialogButtons";
import type {
  FileConflict,
  ProjectCommandError,
} from "@/features/project/commands/projectCommands";
import type { ProjectMetadata } from "@/features/project/types/projectFile";

interface UnsavedChangesDialogProps {
  open: boolean;
  projectName: string;
  /** "close": the desktop window is closing (PROJECT-1.3). */
  intent?: "continue" | "close";
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

/** Shown before New, Open or Import would replace a project with unsaved changes. */
export function UnsavedChangesDialog({
  open,
  projectName,
  intent = "continue",
  onSave,
  onDiscard,
  onClose,
}: UnsavedChangesDialogProps) {
  const saveRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Unsaved Changes"
      initialFocusRef={saveRef}
    >
      <p>
        <span className="text-fg-primary font-medium">“{projectName}”</span> has
        changes that aren&apos;t saved.{" "}
        {intent === "close"
          ? "Save them before closing Layoutry?"
          : "Save them before continuing?"}
      </p>
      <div className={dialogFooterClass}>
        <button
          type="button"
          onClick={onClose}
          className={secondaryButtonClass}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className={secondaryButtonClass}
        >
          Don&apos;t Save
        </button>
        <button
          ref={saveRef}
          type="button"
          onClick={onSave}
          className={primaryButtonClass}
        >
          Save
        </button>
      </div>
    </Dialog>
  );
}

interface DeleteProjectDialogProps {
  target: { name: string | null; isActive: boolean } | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteProjectDialog({
  target,
  onConfirm,
  onClose,
}: DeleteProjectDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title="Delete Project"
      initialFocusRef={cancelRef}
    >
      {target && (
        <>
          <p>
            Delete{" "}
            <span className="text-fg-primary font-medium">
              {target.name === null
                ? "this unreadable project"
                : `“${target.name}”`}
            </span>{" "}
            from this browser&apos;s project library? This is permanent and
            can&apos;t be undone.
          </p>
          {target.isActive && (
            <p className="mt-2">
              It stays open in the editor as an unsaved project.
            </p>
          )}
          <div className={dialogFooterClass}>
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={dangerButtonClass}
            >
              Delete Permanently
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

interface ImportCollisionDialogProps {
  existing: ProjectMetadata | null;
  onImportCopy: () => void;
  onReplace: () => void;
  onClose: () => void;
}

/** The imported file has the id of a project already in the library. */
export function ImportCollisionDialog({
  existing,
  onImportCopy,
  onReplace,
  onClose,
}: ImportCollisionDialogProps) {
  const copyRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={existing !== null}
      onClose={onClose}
      title="Project Already in Library"
      initialFocusRef={copyRef}
    >
      {existing && (
        <>
          <p>
            This file is a version of{" "}
            <span className="text-fg-primary font-medium">
              “{existing.name}”
            </span>
            , which is already in your library (edited{" "}
            {formatProjectDate(existing.updatedAt)}).
          </p>
          <p className="mt-2">
            Import it as a separate copy, or replace the library version with
            the file. Replacing can&apos;t be undone.
          </p>
          <div className={dialogFooterClass}>
            <button
              type="button"
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onReplace}
              className={dangerButtonClass}
            >
              Replace Existing
            </button>
            <button
              ref={copyRef}
              type="button"
              onClick={onImportCopy}
              className={primaryButtonClass}
            >
              Import as Copy
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

interface ProjectErrorDialogProps {
  error: ProjectCommandError | null;
  onClose: () => void;
}

export function ProjectErrorDialog({
  error,
  onClose,
}: ProjectErrorDialogProps) {
  const okRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={error !== null}
      onClose={onClose}
      title={error?.title ?? ""}
      initialFocusRef={okRef}
    >
      {error && (
        <>
          <p role="alert">{error.message}</p>
          <div className={dialogFooterClass}>
            <button
              ref={okRef}
              type="button"
              onClick={onClose}
              className={primaryButtonClass}
            >
              OK
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

interface FileConflictDialogProps {
  conflict: FileConflict | null;
  onOverwrite: () => void;
  onSaveAs: () => void;
  onClose: () => void;
}

/**
 * Saving would replace a version of the file Layoutry hasn't seen
 * (PROJECT-1.3). Nothing is written until the user picks an option; Cancel
 * is focused, and overwriting is never the default.
 */
export function FileConflictDialog({
  conflict,
  onOverwrite,
  onSaveAs,
  onClose,
}: FileConflictDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const missing = conflict?.reason === "missing";
  return (
    <Dialog
      open={conflict !== null}
      onClose={onClose}
      title={
        missing ? "File Moved or Deleted" : "File Changed Outside Layoutry"
      }
      initialFocusRef={cancelRef}
    >
      {conflict && (
        <>
          <p role="alert">
            {missing ? (
              <>
                <span className="text-fg-primary font-medium">
                  “{conflict.fileName}”
                </span>{" "}
                was moved, renamed or deleted after you opened or saved it.
              </>
            ) : (
              <>
                <span className="text-fg-primary font-medium">
                  “{conflict.fileName}”
                </span>{" "}
                was changed by another program or person after you opened or
                saved it. Saving now would replace those changes.
              </>
            )}
          </p>
          <p className="mt-2">
            Nothing has been saved yet. Use Save As to keep both versions.
          </p>
          <div className={dialogFooterClass}>
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onOverwrite}
              className={dangerButtonClass}
            >
              {missing ? "Save Here Anyway" : "Overwrite"}
            </button>
            <button
              type="button"
              onClick={onSaveAs}
              className={primaryButtonClass}
            >
              Save As…
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
