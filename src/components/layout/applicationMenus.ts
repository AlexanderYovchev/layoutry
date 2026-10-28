import type { MenuItem, TopLevelMenu } from "@/components/ui/menu/types";

export interface ViewState {
  resourcePanelVisible: boolean;
  inspectorPanelVisible: boolean;
  statusBarVisible: boolean;
}

export type HelpDialogId = "getting-started" | "keyboard-shortcuts" | "about";

/**
 * Plain callbacks/booleans only — no feature types — since components/
 * layout must not import src/features/* (see CLAUDE.md's Dependency
 * Direction rules). EditorApp (the composition root) computes these from
 * the real editor store and passes them down the same way
 * onActivateCatalogCard already threads through AppShell/CreationToolbar.
 */
export interface EditMenuCommands {
  canUndo: boolean;
  canRedo: boolean;
  canCut: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * PROJECT-1.2 — the File menu's project commands, as plain callbacks for
 * the same reason as EditMenuCommands. The project feature computes them
 * (ProjectWorkspace) and they reach the header through EditorApp/AppShell.
 */
export interface FileMenuCommands {
  /**
   * PROJECT-1.3 — "desktop": projects are native .layoutry files (Open
   * File…, Save/Save As via native dialogs) and the browser library is
   * reachable as "Desktop Library" for projects saved before files existed.
   * Defaults to "browser".
   */
  mode?: "browser" | "desktop";
  /** Desktop: lists the local project library (pre-1.3 projects). */
  onOpenLibrary?: () => void;
  /** PROJECT-1.4 — offers work recovered from sessions that ended unsaved. */
  onRecover?: () => void;
  /** False while a library operation (save, open, import…) is in flight. */
  canUseLibrary: boolean;
  /** Most recently saved projects, newest first. */
  recentProjects: readonly { id: string; name: string }[];
  onNewProject: () => void;
  onOpenProject: () => void;
  onOpenRecent: (id: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onRename: () => void;
  onImport: () => void;
  onDownload: () => void;
  /**
   * EXPORT-1.4 — opens the code export dialog (HTML/CSS source, not the
   * editable project). Absent where export isn't wired in: no menu item
   * and no header button.
   */
  onExportCode?: () => void;
}

interface BuildApplicationMenusOptions {
  viewState: ViewState;
  onToggleView: (region: keyof ViewState) => void;
  onOpenHelpDialog: (id: HelpDialogId) => void;
  editMenuCommands: EditMenuCommands;
  /** Absent when the shell is rendered without a project (tests): every item is disabled. */
  fileMenuCommands?: FileMenuCommands;
}

function separator(id: string): MenuItem {
  return { type: "separator", id };
}

/** Kept in its own group, apart from Save and Download Project: it exports code, not the project. */
function exportCodeItems(commands: FileMenuCommands | undefined): MenuItem[] {
  if (!commands?.onExportCode) return [];
  return [
    separator("file-sep-export"),
    {
      type: "command",
      id: "file-export-code",
      label: "Export Code…",
      onSelect: commands.onExportCode,
    },
  ];
}

function desktopFileMenu(commands: FileMenuCommands): TopLevelMenu {
  const busy = !commands.canUseLibrary;
  return {
    id: "file",
    label: "File",
    items: [
      {
        type: "command",
        id: "file-new-project",
        label: "New Project",
        shortcut: "Ctrl+N",
        disabled: busy,
        onSelect: commands.onNewProject,
      },
      {
        type: "command",
        id: "file-open-file",
        label: "Open File…",
        shortcut: "Ctrl+O",
        disabled: busy,
        onSelect: commands.onOpenProject,
      },
      {
        type: "command",
        id: "file-open-library",
        label: "Open from Desktop Library…",
        disabled: busy,
        onSelect: commands.onOpenLibrary,
      },
      {
        type: "command",
        id: "file-recover",
        label: "Recover Unsaved Work…",
        disabled: busy || !commands.onRecover,
        onSelect: commands.onRecover,
      },
      separator("file-sep-1"),
      {
        type: "command",
        id: "file-save",
        label: "Save",
        shortcut: "Ctrl+S",
        disabled: busy,
        onSelect: commands.onSave,
      },
      {
        type: "command",
        id: "file-save-as",
        label: "Save As…",
        shortcut: "Ctrl+Shift+S",
        disabled: busy,
        onSelect: commands.onSaveAs,
      },
      {
        type: "command",
        id: "file-rename-project",
        label: "Rename Project…",
        onSelect: commands.onRename,
      },
      ...exportCodeItems(commands),
    ],
  };
}

function fileMenu(commands: FileMenuCommands | undefined): TopLevelMenu {
  if (commands?.mode === "desktop") return desktopFileMenu(commands);
  const libraryDisabled = !commands?.canUseLibrary;
  const recentProjects = commands?.recentProjects ?? [];
  return {
    id: "file",
    label: "File",
    items: [
      {
        type: "command",
        id: "file-new-project",
        label: "New Project",
        disabled: libraryDisabled,
        onSelect: commands?.onNewProject,
      },
      {
        type: "command",
        id: "file-open-project",
        label: "Open Project…",
        shortcut: "Ctrl+O",
        disabled: libraryDisabled,
        onSelect: commands?.onOpenProject,
      },
      {
        type: "submenu",
        id: "file-open-recent",
        label: "Open Recent",
        items:
          recentProjects.length === 0
            ? [
                {
                  type: "command",
                  id: "file-open-recent-empty",
                  label: "No saved projects",
                  disabled: true,
                },
              ]
            : recentProjects.map((project): MenuItem => ({
                type: "command",
                id: `file-open-recent-${project.id}`,
                label: project.name,
                disabled: libraryDisabled,
                onSelect: () => commands?.onOpenRecent(project.id),
              })),
      },
      {
        type: "command",
        id: "file-recover",
        label: "Recover Unsaved Work…",
        disabled: libraryDisabled || !commands?.onRecover,
        onSelect: commands?.onRecover,
      },
      separator("file-sep-1"),
      {
        type: "command",
        id: "file-save",
        label: "Save",
        shortcut: "Ctrl+S",
        disabled: libraryDisabled,
        onSelect: commands?.onSave,
      },
      {
        type: "command",
        id: "file-save-as",
        label: "Save As…",
        shortcut: "Ctrl+Shift+S",
        disabled: libraryDisabled,
        onSelect: commands?.onSaveAs,
      },
      {
        type: "command",
        id: "file-rename-project",
        label: "Rename Project…",
        disabled: !commands,
        onSelect: commands?.onRename,
      },
      separator("file-sep-2"),
      {
        type: "command",
        id: "file-import-project",
        label: "Import Project…",
        disabled: libraryDisabled,
        onSelect: commands?.onImport,
      },
      {
        type: "command",
        id: "file-download-project",
        label: "Download Project",
        disabled: !commands,
        onSelect: commands?.onDownload,
      },
      ...exportCodeItems(commands),
    ],
  };
}

function editMenu(commands: EditMenuCommands): TopLevelMenu {
  return {
    id: "edit",
    label: "Edit",
    items: [
      {
        type: "command",
        id: "edit-undo",
        label: "Undo",
        shortcut: "Ctrl+Z",
        disabled: !commands.canUndo,
        onSelect: commands.onUndo,
      },
      {
        type: "command",
        id: "edit-redo",
        label: "Redo",
        shortcut: "Ctrl+Shift+Z",
        disabled: !commands.canRedo,
        onSelect: commands.onRedo,
      },
      separator("edit-sep-1"),
      {
        type: "command",
        id: "edit-cut",
        label: "Cut",
        shortcut: "Ctrl+X",
        disabled: !commands.canCut,
        onSelect: commands.onCut,
      },
      {
        type: "command",
        id: "edit-copy",
        label: "Copy",
        shortcut: "Ctrl+C",
        disabled: !commands.canCopy,
        onSelect: commands.onCopy,
      },
      {
        type: "command",
        id: "edit-paste",
        label: "Paste",
        shortcut: "Ctrl+V",
        disabled: !commands.canPaste,
        onSelect: commands.onPaste,
      },
      {
        type: "command",
        id: "edit-duplicate",
        label: "Duplicate",
        shortcut: "Ctrl+D",
        disabled: !commands.canDuplicate,
        onSelect: commands.onDuplicate,
      },
      {
        type: "command",
        id: "edit-delete",
        label: "Delete",
        shortcut: "Delete",
        disabled: !commands.canDelete,
        onSelect: commands.onDelete,
      },
      separator("edit-sep-2"),
      {
        type: "command",
        id: "edit-select-all",
        label: "Select All",
        shortcut: "Ctrl+A",
        disabled: true,
      },
      {
        type: "command",
        id: "edit-deselect",
        label: "Deselect",
        shortcut: "Ctrl+Shift+A",
        disabled: true,
      },
      separator("edit-sep-3"),
      {
        type: "command",
        id: "edit-preferences",
        label: "Preferences",
        disabled: true,
      },
    ],
  };
}

function viewMenu(
  viewState: ViewState,
  onToggleView: (region: keyof ViewState) => void,
): TopLevelMenu {
  return {
    id: "view",
    label: "View",
    items: [
      {
        type: "checkbox",
        id: "view-resource-panel",
        label: "Resource Panel",
        checked: viewState.resourcePanelVisible,
        onSelect: () => onToggleView("resourcePanelVisible"),
      },
      {
        type: "checkbox",
        id: "view-inspector-panel",
        label: "Inspector Panel",
        checked: viewState.inspectorPanelVisible,
        onSelect: () => onToggleView("inspectorPanelVisible"),
      },
      {
        type: "checkbox",
        id: "view-status-bar",
        label: "Status Bar",
        checked: viewState.statusBarVisible,
        onSelect: () => onToggleView("statusBarVisible"),
      },
      separator("view-sep-1"),
      {
        type: "command",
        id: "view-zoom-in",
        label: "Zoom In",
        shortcut: "Ctrl+=",
        disabled: true,
      },
      {
        type: "command",
        id: "view-zoom-out",
        label: "Zoom Out",
        shortcut: "Ctrl+-",
        disabled: true,
      },
      {
        type: "command",
        id: "view-reset-zoom",
        label: "Reset Zoom",
        shortcut: "Ctrl+0",
        disabled: true,
      },
      {
        type: "command",
        id: "view-fit-canvas",
        label: "Fit Canvas",
        disabled: true,
      },
      separator("view-sep-2"),
      {
        type: "command",
        id: "view-preview-mode",
        label: "Preview Mode",
        disabled: true,
      },
      {
        type: "command",
        id: "view-full-screen",
        label: "Full Screen",
        shortcut: "F11",
        disabled: true,
      },
      separator("view-sep-3"),
      { type: "command", id: "view-theme", label: "Theme", disabled: true },
    ],
  };
}

function insertMenu(): TopLevelMenu {
  return {
    id: "insert",
    label: "Insert",
    items: [
      {
        type: "command",
        id: "insert-html-element",
        label: "HTML Element…",
        disabled: true,
      },
      {
        type: "command",
        id: "insert-component",
        label: "Component…",
        disabled: true,
      },
      {
        type: "command",
        id: "insert-layout-primitive",
        label: "Layout Primitive…",
        disabled: true,
      },
      { type: "command", id: "insert-media", label: "Media…", disabled: true },
      {
        type: "command",
        id: "insert-form-control",
        label: "Form Control…",
        disabled: true,
      },
      {
        type: "command",
        id: "insert-template-section",
        label: "Template Section…",
        disabled: true,
      },
      separator("insert-sep-1"),
      {
        type: "command",
        id: "insert-search-all",
        label: "Search All Elements…",
        disabled: true,
      },
      {
        type: "command",
        id: "insert-recently-used",
        label: "Recently Used",
        disabled: true,
      },
      {
        type: "command",
        id: "insert-favorites",
        label: "Favorites",
        disabled: true,
      },
    ],
  };
}

function projectMenu(): TopLevelMenu {
  return {
    id: "project",
    label: "Project",
    items: [
      {
        type: "command",
        id: "project-settings",
        label: "Project Settings",
        disabled: true,
      },
      { type: "command", id: "project-pages", label: "Pages", disabled: true },
      {
        type: "command",
        id: "project-assets",
        label: "Assets",
        disabled: true,
      },
      {
        type: "command",
        id: "project-global-styles",
        label: "Global Styles",
        disabled: true,
      },
      {
        type: "command",
        id: "project-css-variables",
        label: "CSS Variables",
        disabled: true,
      },
      {
        type: "command",
        id: "project-design-tokens",
        label: "Design Tokens",
        disabled: true,
      },
      separator("project-sep-1"),
      {
        type: "command",
        id: "project-responsive-breakpoints",
        label: "Responsive Breakpoints",
        disabled: true,
      },
      {
        type: "command",
        id: "project-document-metadata",
        label: "Document Metadata",
        disabled: true,
      },
      {
        type: "command",
        id: "project-custom-code",
        label: "Custom Code",
        disabled: true,
      },
      separator("project-sep-2"),
      {
        type: "command",
        id: "project-history",
        label: "Project History",
        disabled: true,
      },
    ],
  };
}

function helpMenu(onOpenHelpDialog: (id: HelpDialogId) => void): TopLevelMenu {
  return {
    id: "help",
    label: "Help",
    items: [
      {
        type: "command",
        id: "help-getting-started",
        label: "Getting Started",
        onSelect: () => onOpenHelpDialog("getting-started"),
      },
      {
        type: "command",
        id: "help-keyboard-shortcuts",
        label: "Keyboard Shortcuts",
        onSelect: () => onOpenHelpDialog("keyboard-shortcuts"),
      },
      {
        type: "command",
        id: "help-documentation",
        label: "Documentation",
        disabled: true,
      },
      {
        type: "command",
        id: "help-html-reference",
        label: "HTML Reference",
        disabled: true,
      },
      {
        type: "command",
        id: "help-css-reference",
        label: "CSS Reference",
        disabled: true,
      },
      separator("help-sep-1"),
      {
        type: "command",
        id: "help-report-problem",
        label: "Report a Problem",
        disabled: true,
      },
      {
        type: "command",
        id: "help-send-feedback",
        label: "Send Feedback",
        disabled: true,
      },
      separator("help-sep-2"),
      {
        type: "command",
        id: "help-about",
        label: "About Layoutry",
        onSelect: () => onOpenHelpDialog("about"),
      },
    ],
  };
}

export function buildApplicationMenus({
  viewState,
  onToggleView,
  onOpenHelpDialog,
  editMenuCommands,
  fileMenuCommands,
}: BuildApplicationMenusOptions): TopLevelMenu[] {
  return [
    fileMenu(fileMenuCommands),
    editMenu(editMenuCommands),
    viewMenu(viewState, onToggleView),
    insertMenu(),
    projectMenu(),
    helpMenu(onOpenHelpDialog),
  ];
}
