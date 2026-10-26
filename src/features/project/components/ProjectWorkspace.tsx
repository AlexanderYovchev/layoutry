"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { FileMenuCommands } from "@/components/layout/applicationMenus";
import type { ProjectIdentityInfo } from "@/components/layout/ProjectIdentity";
import { EditorApp } from "@/features/editor/components/EditorApp";
import { createProjectCommands } from "@/features/project/commands/projectCommands";
import { createProjectWorkflow } from "@/features/project/commands/projectWorkflow";
import {
  DeleteProjectDialog,
  ImportCollisionDialog,
  ProjectErrorDialog,
  UnsavedChangesDialog,
} from "@/features/project/components/ProjectConfirmDialogs";
import { ProjectLibraryDialog } from "@/features/project/components/ProjectLibraryDialog";
import { ProjectNameDialog } from "@/features/project/components/ProjectNameDialog";
import { ProjectToast } from "@/features/project/components/ProjectToast";
import { useHasUnsavedProjectChanges } from "@/features/project/hooks/useHasUnsavedProjectChanges";
import {
  useProjectKeyboardShortcuts,
  type ProjectShortcutHandlers,
} from "@/features/project/hooks/useProjectKeyboardShortcuts";
import { useUnsavedChangesWarning } from "@/features/project/hooks/useUnsavedChangesWarning";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import type { ProjectRepository } from "@/features/project/storage/projectRepository";
import { useProjectDialogStore } from "@/features/project/stores/useProjectDialogStore";
import { useProjectStore } from "@/features/project/stores/useProjectStore";
import {
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MEDIA_TYPE,
} from "@/features/project/types/projectFile";
import { downloadTextFile } from "@/features/project/utils/downloadTextFile";

const RECENT_PROJECT_COUNT = 5;

interface ProjectWorkspaceProps {
  /** Defaults to the browser's IndexedDB project library; tests inject their own. */
  createRepository?: () => ProjectRepository;
}

/**
 * The editor with project management (PROJECT-1.2): wraps EditorApp and
 * supplies the File menu, the header's project name and status, the project
 * dialogs, project shortcuts and the unload warning. The editor feature
 * never imports this one; it only receives plain props.
 */
export function ProjectWorkspace({
  createRepository = createIndexedDbProjectRepository,
}: ProjectWorkspaceProps) {
  const [workflow] = useState(() =>
    createProjectWorkflow(
      createProjectCommands({
        repository: createRepository(),
        saveFile: (fileName, text) =>
          downloadTextFile(fileName, text, PROJECT_FILE_MEDIA_TYPE),
      }),
    ),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const metadata = useProjectStore((state) => state.metadata);
  const libraryRevision = useProjectStore((state) => state.libraryRevision);
  const operation = useProjectStore((state) => state.operation);
  const library = useProjectStore((state) => state.library);
  const libraryOpen = useProjectDialogStore((state) => state.libraryOpen);
  const dialog = useProjectDialogStore((state) => state.dialog);
  const hasUnsavedChanges = useHasUnsavedProjectChanges();
  const busy = operation !== null;

  useUnsavedChangesWarning();

  // Loads the library once so File › Open Recent is populated.
  useEffect(() => {
    void workflow.commands.refreshLibrary();
  }, [workflow]);

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
      onOpenProject: () => workflow.showLibrary(),
      onSave: () => void workflow.save(),
      onSaveAs: () => workflow.saveAs(),
    }),
    [workflow],
  );
  useProjectKeyboardShortcuts(shortcutHandlers);

  const fileMenuCommands: FileMenuCommands = {
    canUseLibrary: !busy,
    recentProjects: library.entries
      .flatMap((entry) => (entry.status === "ok" ? [entry.summary] : []))
      .slice(0, RECENT_PROJECT_COUNT),
    onNewProject: () => void workflow.newProject(),
    onOpenProject: () => workflow.showLibrary(),
    onOpenRecent: (id) => void workflow.openProject(id),
    onSave: () => void workflow.save(),
    onSaveAs: () => workflow.saveAs(),
    onRename: () => workflow.rename(),
    onImport: chooseImportFile,
    onDownload: () => void workflow.download(),
  };

  const project: ProjectIdentityInfo = {
    name: metadata.name,
    status: busy
      ? "saving"
      : hasUnsavedChanges
        ? "unsaved"
        : libraryRevision === null
          ? "new"
          : "saved",
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
        onSave={() => void workflow.resolveDiscard("save")}
        onDiscard={() => void workflow.resolveDiscard("discard")}
        onClose={() => closeDialogOfKind("discard")}
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
      <ProjectErrorDialog
        error={dialog?.kind === "error" ? dialog.error : null}
        onClose={() => closeDialogOfKind("error")}
      />
      <ProjectToast />
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
