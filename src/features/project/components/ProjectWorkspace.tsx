"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ReactNode,
} from "react";
import type { FileMenuCommands } from "@/components/layout/applicationMenus";
import type { ProjectIdentityInfo } from "@/components/layout/ProjectIdentity";
import { EditorApp } from "@/features/editor/components/EditorApp";
import { createProjectCommands } from "@/features/project/commands/projectCommands";
import { createProjectWorkflow } from "@/features/project/commands/projectWorkflow";
import {
  createRecoveryCoordinator,
  type RecoveryCoordinatorOptions,
} from "@/features/project/commands/recoveryCoordinator";
import {
  DeleteProjectDialog,
  FileConflictDialog,
  ImportCollisionDialog,
  ProjectErrorDialog,
  UnsavedChangesDialog,
} from "@/features/project/components/ProjectConfirmDialogs";
import { ProjectLibraryDialog } from "@/features/project/components/ProjectLibraryDialog";
import { ProjectNameDialog } from "@/features/project/components/ProjectNameDialog";
import { ProjectToast } from "@/features/project/components/ProjectToast";
import { RecoveryDialog } from "@/features/project/components/RecoveryDialog";
import {
  getDesktopProjectFiles,
  type DesktopProjectFiles,
} from "@/features/project/desktop/desktopProjectFiles";
import { getDesktopRecoveryStorage } from "@/features/project/desktop/desktopRecoveryStorage";
import { useDesktopIntegration } from "@/features/project/hooks/useDesktopIntegration";
import { useHasUnsavedProjectChanges } from "@/features/project/hooks/useHasUnsavedProjectChanges";
import {
  useProjectKeyboardShortcuts,
  type ProjectShortcutHandlers,
} from "@/features/project/hooks/useProjectKeyboardShortcuts";
import { useUnsavedChangesWarning } from "@/features/project/hooks/useUnsavedChangesWarning";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import { createBrowserRecoveryStorage } from "@/features/project/storage/indexedDbRecoveryStorage";
import {
  ProjectStorageError,
  type ProjectRepository,
} from "@/features/project/storage/projectRepository";
import type { RecoveryStorage } from "@/features/project/storage/recoveryStorage";
import { useProjectDialogStore } from "@/features/project/stores/useProjectDialogStore";
import { useProjectStore } from "@/features/project/stores/useProjectStore";
import { useRecoveryStore } from "@/features/project/stores/useRecoveryStore";
import {
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MEDIA_TYPE,
} from "@/features/project/types/projectFile";
import { downloadTextFile } from "@/lib/downloadTextFile";
import {
  createWorkerSnapshotPreparer,
  type WorkerSnapshotPreparer,
} from "@/features/project/workers/createWorkerSnapshotPreparer";

const RECENT_PROJECT_COUNT = 5;

function subscribeToNothing(): () => void {
  return () => undefined;
}

interface ProjectWorkspaceProps {
  /** Defaults to the browser's IndexedDB project library; tests inject their own. */
  createRepository?: () => ProjectRepository;
  /** The desktop app's native-file bridge, or null in a browser (the default detects it). */
  createDesktopFiles?: () => DesktopProjectFiles | null;
  /**
   * Where recovery snapshots go (PROJECT-1.4): the desktop Recovery folder
   * or the browser's IndexedDB by default; null where neither works.
   */
  createRecoveryStorage?: (desktop: boolean) => RecoveryStorage | null;
  /** Tests shorten the recovery timers. */
  recoveryTiming?: RecoveryCoordinatorOptions["timing"];
  /**
   * Prepares recovery snapshots in a worker where one is available
   * (PROJECT-1.5), on the page otherwise.
   */
  createSnapshotPreparer?: () => WorkerSnapshotPreparer;
  /**
   * EXPORT-1.4 — code export, composed by the app: the export feature
   * already depends on this one (project limits), so this feature never
   * imports it. Adds File › Export Code… and the header's Export button.
   */
  codeExport?: CodeExportIntegration;
}

export interface CodeExportIntegration {
  onOpen: () => void;
  /** Rendered with the project overlays; the project name becomes the exported page's title. */
  renderDialog: (projectName: string) => ReactNode;
}

function defaultRecoveryStorage(desktop: boolean): RecoveryStorage | null {
  return desktop ? getDesktopRecoveryStorage() : createBrowserRecoveryStorage();
}

const RECOVERY_UNSUPPORTED =
  "This browser can't keep recovery copies on this page (it needs a secure https connection). Save your work to keep it.";

/**
 * The editor with project management (PROJECT-1.2): wraps EditorApp and
 * supplies the File menu, the header's project name and status, the project
 * dialogs, project shortcuts and the unload warning. The editor feature
 * never imports this one; it only receives plain props.
 *
 * In the desktop app (PROJECT-1.3) projects are native .layoutry files and
 * closing the window is coordinated with the main process; in a browser it
 * is the IndexedDB library, exactly as in PROJECT-1.2.
 *
 * Recovery (PROJECT-1.4): unsaved work is copied automatically to recovery
 * storage, never to the project's own destination, and offered back after
 * a crash or an unexpected close.
 */
export function ProjectWorkspace({
  createRepository = createIndexedDbProjectRepository,
  createDesktopFiles = getDesktopProjectFiles,
  createRecoveryStorage = defaultRecoveryStorage,
  recoveryTiming,
  createSnapshotPreparer = createWorkerSnapshotPreparer,
  codeExport,
}: ProjectWorkspaceProps) {
  const [{ workflow, desktop, recovery }] = useState(() => {
    const desktopFiles = createDesktopFiles();
    const repository = createRepository();
    const recoveryStorage = createRecoveryStorage(desktopFiles !== null);
    const snapshotPreparer = recoveryStorage ? createSnapshotPreparer() : null;
    const recoveryCoordinator = recoveryStorage
      ? createRecoveryCoordinator({
          storage: recoveryStorage,
          timing: recoveryTiming,
          prepareSnapshot: snapshotPreparer?.prepare,
          findLibraryProject: (id) =>
            repository.read(id).then(
              (stored) => ({
                updatedAt: stored.metadata.updatedAt,
                text: stored.text,
              }),
              (error: unknown) => {
                if (
                  error instanceof ProjectStorageError &&
                  error.code === "not-found"
                )
                  return null;
                throw error;
              },
            ),
          releaseFile: (token) => desktopFiles?.releaseProjectFile(token),
        })
      : null;
    return {
      desktop: desktopFiles,
      recovery: recoveryCoordinator,
      workflow: createProjectWorkflow(
        createProjectCommands({
          repository,
          desktop: desktopFiles,
          saveFile: (fileName, text) =>
            downloadTextFile(fileName, text, PROJECT_FILE_MEDIA_TYPE),
        }),
        desktopFiles,
        recoveryCoordinator,
      ),
    };
  });
  // The static HTML is prerendered as the browser editor. Rendering the
  // desktop variant only after hydration keeps the first client render
  // identical to it (no hydration mismatch); behaviour uses `desktop` directly.
  const isDesktop = useSyncExternalStore(
    subscribeToNothing,
    () => desktop !== null,
    () => false,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const metadata = useProjectStore((state) => state.metadata);
  const location = useProjectStore((state) => state.location);
  const operation = useProjectStore((state) => state.operation);
  const library = useProjectStore((state) => state.library);
  const libraryOpen = useProjectDialogStore((state) => state.libraryOpen);
  const dialog = useProjectDialogStore((state) => state.dialog);
  const hasUnsavedChanges = useHasUnsavedProjectChanges();
  const recoveryStatus = useRecoveryStore((state) => state.status);
  const recoveryMessage = useRecoveryStore((state) => state.message);
  const busy = operation !== null;

  useUnsavedChangesWarning(desktop === null);
  useDesktopIntegration(workflow, desktop);

  // Loads the library once so File › Open Recent is populated.
  useEffect(() => {
    void workflow.commands.refreshLibrary();
  }, [workflow]);

  // Recovery first (it may offer work from a crashed session), then a file
  // named on the desktop command line.
  useEffect(() => {
    if (!recovery)
      useRecoveryStore
        .getState()
        .setStatus("unavailable", RECOVERY_UNSUPPORTED);
    void workflow.startup();
    void recovery?.start();
    return () => recovery?.stop();
  }, [workflow, recovery]);

  function chooseImportFile() {
    fileInputRef.current?.click();
  }

  function handleImportFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file again still fires a change.
    event.target.value = "";
    if (file) void workflow.importFile(file);
  }

  const shortcutHandlers = useMemo<ProjectShortcutHandlers>(
    () => ({
      onNewProject: () => {
        if (useProjectStore.getState().operation === null)
          void workflow.newProject();
      },
      onOpenProject: () =>
        isDesktop ? void workflow.openFile() : workflow.showLibrary(),
      onSave: () => void workflow.save(),
      onSaveAs: () => void workflow.saveAs(),
    }),
    [workflow, isDesktop],
  );
  useProjectKeyboardShortcuts(shortcutHandlers);

  const fileMenuCommands: FileMenuCommands = {
    mode: isDesktop ? "desktop" : "browser",
    onOpenLibrary: () => workflow.showLibrary(),
    onRecover: () => void workflow.showRecovery(),
    canUseLibrary: !busy,
    recentProjects: library.entries
      .flatMap((entry) => (entry.status === "ok" ? [entry.summary] : []))
      .slice(0, RECENT_PROJECT_COUNT),
    onNewProject: () => void workflow.newProject(),
    onOpenProject: () =>
      isDesktop ? void workflow.openFile() : workflow.showLibrary(),
    onOpenRecent: (id) => void workflow.openProject(id),
    onSave: () => void workflow.save(),
    onSaveAs: () => void workflow.saveAs(),
    onRename: () => workflow.rename(),
    onImport: chooseImportFile,
    onDownload: () => void workflow.download(),
    onExportCode: codeExport?.onOpen,
  };

  const project: ProjectIdentityInfo = {
    name: metadata.name,
    status: busy
      ? "saving"
      : hasUnsavedChanges
        ? "unsaved"
        : location.kind === "unsaved"
          ? "new"
          : "saved",
    source:
      location.kind === "file"
        ? {
            label: location.fileName,
            description: `Saved to the file ${location.fileName}`,
          }
        : location.kind === "library"
          ? isDesktop
            ? {
                label: "Desktop library",
                description:
                  "Saved in Layoutry's desktop library on this computer",
              }
            : {
                label: "Browser library",
                description:
                  "Saved in this browser's project library on this device",
              }
          : undefined,
    recovery: !hasUnsavedChanges
      ? undefined
      : recoveryStatus === "protected"
        ? {
            state: "protected",
            description:
              "Your latest changes have a recovery copy on this device. They are not saved yet.",
          }
        : recoveryStatus === "unavailable"
          ? {
              state: "unavailable",
              description:
                recoveryMessage ??
                "Recovery copies can't be made right now. Save your work to keep it.",
            }
          : undefined,
    onRename: () => workflow.rename(),
  };

  const { closeDialogOfKind, setLibraryOpen } =
    useProjectDialogStore.getState();

  const overlays = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={`${PROJECT_FILE_EXTENSION},${PROJECT_FILE_MEDIA_TYPE},application/json`}
        onChange={handleImportFileChosen}
        tabIndex={-1}
        aria-hidden="true"
        data-testid="project-import-input"
        className="hidden"
      />
      <ProjectLibraryDialog
        open={libraryOpen}
        library={library}
        activeProjectId={metadata.id}
        busy={busy}
        onOpenProject={(id) => void workflow.openProject(id)}
        onDeleteProject={(id, name) => workflow.requestDelete(id, name)}
        onRetry={() => void workflow.commands.refreshLibrary()}
        onClose={() => setLibraryOpen(false)}
        variant={isDesktop ? "desktop" : "browser"}
      />
      <ProjectNameDialog
        purpose={dialog?.kind === "name" ? dialog.purpose : null}
        initialName={
          dialog?.kind === "name" && dialog.purpose === "save-as"
            ? `${metadata.name} copy`
            : metadata.name
        }
        onSubmit={(purpose, name) => void workflow.submitName(purpose, name)}
        onClose={() => closeDialogOfKind("name")}
      />
      <UnsavedChangesDialog
        open={dialog?.kind === "discard"}
        projectName={metadata.name}
        intent={
          dialog?.kind === "discard" && dialog.pending.kind === "close"
            ? "close"
            : "continue"
        }
        onSave={() => void workflow.resolveDiscard("save")}
        onDiscard={() => void workflow.resolveDiscard("discard")}
        onClose={() => workflow.cancelDiscard()}
      />
      <FileConflictDialog
        conflict={dialog?.kind === "file-conflict" ? dialog.conflict : null}
        onOverwrite={() => void workflow.resolveFileConflict("overwrite")}
        onSaveAs={() => void workflow.resolveFileConflict("save-as")}
        onClose={() => closeDialogOfKind("file-conflict")}
      />
      <DeleteProjectDialog
        target={
          dialog?.kind === "delete"
            ? { name: dialog.name, isActive: dialog.id === metadata.id }
            : null
        }
        onConfirm={() => void workflow.confirmDelete()}
        onClose={() => closeDialogOfKind("delete")}
      />
      <ImportCollisionDialog
        existing={dialog?.kind === "import-collision" ? dialog.existing : null}
        onImportCopy={() => void workflow.resolveImportCollision("copy")}
        onReplace={() => void workflow.resolveImportCollision("replace")}
        onClose={() => closeDialogOfKind("import-collision")}
      />
      <RecoveryDialog
        dialog={dialog?.kind === "recovery" ? dialog : null}
        variant={isDesktop ? "desktop" : "browser"}
        onRestore={(groupKey, recordId) =>
          void workflow.restoreRecovery(groupKey, recordId)
        }
        onDiscard={(groupKey) => void workflow.discardRecovery(groupKey)}
        onKeep={() => workflow.keepRecoveryForLater()}
      />
      <ProjectErrorDialog
        error={dialog?.kind === "error" ? dialog.error : null}
        onClose={() => closeDialogOfKind("error")}
      />
      <ProjectToast />
      {codeExport?.renderDialog(metadata.name)}
    </>
  );

  return (
    <EditorApp
      fileMenuCommands={fileMenuCommands}
      project={project}
      overlays={overlays}
    />
  );
}
