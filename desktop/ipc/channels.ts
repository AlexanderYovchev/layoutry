/**
 * The complete desktop IPC surface (PROJECT-1.3). The preload script
 * (desktop/preload/preload.ts) must stay self-contained under the sandbox,
 * so it repeats these names; channels.test.ts keeps the two in sync.
 * Nothing else is ever handled: there is no generic invoke channel.
 */
export const INVOKE_CHANNELS = {
  openProjectFile: "layoutry:project-file:open",
  takePendingProjectFile: "layoutry:project-file:take-pending",
  chooseSaveLocation: "layoutry:project-file:choose-save-location",
  writeProjectFile: "layoutry:project-file:write",
  releaseProjectFile: "layoutry:project-file:release",
  setUnsavedChanges: "layoutry:window:set-unsaved",
  respondToCloseRequest: "layoutry:window:close-response",
} as const;

/** Main → renderer notifications. They carry no data. */
export const EVENT_CHANNELS = {
  closeRequested: "layoutry:window:close-requested",
  pendingProjectFile: "layoutry:project-file:pending",
} as const;
