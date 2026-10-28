"use client";

import { useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { formatProjectDate } from "@/features/project/components/ProjectLibraryDialog";
import {
  dangerButtonClass,
  dialogFooterClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/dialogButtons";
import type { ProjectDialog } from "@/features/project/stores/useProjectDialogStore";
import type {
  OriginalState,
  RecoveryGroup,
} from "@/features/project/types/recoveryRecord";

type RecoveryDialogState = Extract<ProjectDialog, { kind: "recovery" }>;

interface RecoveryDialogProps {
  dialog: RecoveryDialogState | null;
  variant: "browser" | "desktop";
  onRestore: (groupKey: string, recordId: string) => void;
  onDiscard: (groupKey: string) => void;
  onKeep: () => void;
}

function sourceLabel(
  group: RecoveryGroup,
  variant: RecoveryDialogProps["variant"],
): string {
  switch (group.source.kind) {
    case "unsaved":
      return "Never saved";
    case "library":
      return variant === "desktop"
        ? "From the desktop library"
        : "From this browser's project library";
    case "file":
      return `From the file ${group.source.fileName}`;
  }
}

const ORIGINAL_NOTES: Record<OriginalState, string> = {
  unchanged: "The saved copy hasn't changed since then.",
  modified:
    "The saved copy has changed since then. Restoring never overwrites it: Save will ask first.",
  missing: "The saved copy can't be found any more.",
  unavailable: "The saved copy can't be checked right now.",
};

function firstRestorable(group: RecoveryGroup): string | null {
  return group.versions.find((version) => !version.damaged)?.recordId ?? null;
}

/**
 * Offers work left by sessions that ended without saving (PROJECT-1.4):
 * Restore a version, Keep for Later, or Discard after a confirmation.
 * Nothing is restored or deleted until the user chooses.
 */
export function RecoveryDialog({
  dialog,
  variant,
  onRestore,
  onDiscard,
  onKeep,
}: RecoveryDialogProps) {
  const restoreRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const groups = dialog?.groups ?? [];
  const busy = dialog?.busy ?? false;

  return (
    <Dialog
      open={dialog !== null}
      onClose={onKeep}
      title="Recover Unsaved Work"
      size="lg"
      initialFocusRef={groups.length > 0 ? restoreRef : keepRef}
    >
      {groups.length === 0 ? (
        <>
          <p>There&apos;s no unsaved work to recover.</p>
          <div className={dialogFooterClass}>
            <button
              ref={keepRef}
              type="button"
              onClick={onKeep}
              className={primaryButtonClass}
            >
              OK
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Layoutry found changes that weren&apos;t saved before it last
            closed. Nothing has been restored or deleted.
          </p>
          <ul className="mt-3 flex flex-col gap-3" aria-label="Recovered work">
            {groups.map((group, index) => {
              const choice =
                selected[group.key] &&
                group.versions.some(
                  (version) =>
                    version.recordId === selected[group.key] &&
                    !version.damaged,
                )
                  ? selected[group.key]
                  : firstRestorable(group);
              const newest = group.versions[0];
              const error =
                dialog?.error?.groupKey === group.key
                  ? dialog.error.message
                  : null;
              return (
                <li
                  key={group.key}
                  className="rounded-card border-line bg-surface-panel-secondary border p-3"
                  aria-label={group.projectName}
                >
                  <p className="text-fg-primary truncate font-medium">
                    {group.projectName}
                  </p>
                  <p className="text-fg-secondary mt-0.5 text-xs">
                    {sourceLabel(group, variant)}
                    {newest?.savedAt
                      ? ` · Recovered ${formatProjectDate(newest.savedAt)}`
                      : ""}
                  </p>
                  {group.original && (
                    <p className="text-fg-secondary mt-1 text-xs">
                      {ORIGINAL_NOTES[group.original]}
                    </p>
                  )}
                  {!group.restorable && (
                    <p role="alert" className="mt-2 text-xs text-red-700">
                      This recovered work is damaged and can&apos;t be restored.
                    </p>
                  )}
                  {group.restorable && group.versions.length > 1 && (
                    <label className="text-fg-secondary mt-2 flex items-center gap-2 text-xs">
                      Version
                      <select
                        value={choice ?? ""}
                        disabled={busy}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [group.key]: event.target.value,
                          }))
                        }
                        className="border-line bg-surface-panel text-fg-primary rounded-control-sm min-w-0 flex-1 border px-1.5 py-1 text-xs"
                      >
                        {group.versions.map((version, position) => (
                          <option
                            key={version.recordId}
                            value={version.recordId}
                            disabled={version.damaged}
                          >
                            {version.savedAt
                              ? formatProjectDate(version.savedAt)
                              : "Unknown time"}
                            {position === 0 ? " (latest)" : ""}
                            {version.damaged ? " — damaged" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {error && (
                    <p role="alert" className="mt-2 text-xs text-red-700">
                      {error}
                    </p>
                  )}
                  {confirming === group.key ? (
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      <p className="text-fg-primary mr-auto text-xs">
                        Discard this recovered work permanently?
                      </p>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className={secondaryButtonClass}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setConfirming(null);
                          onDiscard(group.key);
                        }}
                        className={dangerButtonClass}
                      >
                        Discard Permanently
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirming(group.key)}
                        className={secondaryButtonClass}
                      >
                        Discard…
                      </button>
                      <button
                        ref={index === 0 ? restoreRef : undefined}
                        type="button"
                        disabled={busy || !group.restorable || choice === null}
                        onClick={() => {
                          if (choice) onRestore(group.key, choice);
                        }}
                        className={primaryButtonClass}
                      >
                        Restore
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-fg-secondary mt-3 text-xs">
            Restored work opens as unsaved. Save it to keep it. Recovery copies
            are kept on this device only and aren&apos;t backups.
          </p>
          <div className={dialogFooterClass}>
            <button
              ref={keepRef}
              type="button"
              disabled={busy}
              onClick={onKeep}
              className={secondaryButtonClass}
            >
              Keep for Later
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
