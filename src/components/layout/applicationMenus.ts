import type { MenuItem, TopLevelMenu } from "@/components/ui/menu/types";

export interface ViewState {
  resourcePanelVisible: boolean;
  inspectorPanelVisible: boolean;
  statusBarVisible: boolean;
}

export type HelpDialogId = "getting-started" | "keyboard-shortcuts" | "about";

interface BuildApplicationMenusOptions {
  viewState: ViewState;
  onToggleView: (region: keyof ViewState) => void;
  onOpenHelpDialog: (id: HelpDialogId) => void;
}

function separator(id: string): MenuItem {
  return { type: "separator", id };
}

function fileMenu(): TopLevelMenu {
  return {
    id: "file",
    label: "File",
    items: [
      {
        type: "command",
        id: "file-new-project",
        label: "New Project",
        disabled: true,
      },
      {
        type: "command",
        id: "file-open-project",
        label: "Open Project",
        disabled: true,
      },
      {
        type: "submenu",
        id: "file-open-recent",
        label: "Open Recent",
        items: [
          {
            type: "command",
            id: "file-open-recent-empty",
            label: "No recent projects",
            disabled: true,
          },
        ],
      },
      separator("file-sep-1"),
      {
        type: "command",
        id: "file-save",
        label: "Save",
        shortcut: "Ctrl+S",
        disabled: true,
      },
      {
        type: "command",
        id: "file-save-as",
        label: "Save As",
        shortcut: "Ctrl+Shift+S",
        disabled: true,
      },
      separator("file-sep-2"),
      { type: "command", id: "file-import", label: "Import", disabled: true },
      { type: "command", id: "file-export", label: "Export", disabled: true },
      separator("file-sep-3"),
      {
        type: "command",
        id: "file-project-settings",
        label: "Project Settings",
        disabled: true,
      },
    ],
  };
}

function editMenu(): TopLevelMenu {
  return {
    id: "edit",
    label: "Edit",
    items: [
      {
        type: "command",
        id: "edit-undo",
        label: "Undo",
        shortcut: "Ctrl+Z",
        disabled: true,
      },
      {
        type: "command",
        id: "edit-redo",
        label: "Redo",
        shortcut: "Ctrl+Shift+Z",
        disabled: true,
      },
      separator("edit-sep-1"),
      {
        type: "command",
        id: "edit-cut",
        label: "Cut",
        shortcut: "Ctrl+X",
        disabled: true,
      },
      {
        type: "command",
        id: "edit-copy",
        label: "Copy",
        shortcut: "Ctrl+C",
        disabled: true,
      },
      {
        type: "command",
        id: "edit-paste",
        label: "Paste",
        shortcut: "Ctrl+V",
        disabled: true,
      },
      {
        type: "command",
        id: "edit-duplicate",
        label: "Duplicate",
        shortcut: "Ctrl+D",
        disabled: true,
      },
      {
        type: "command",
        id: "edit-delete",
        label: "Delete",
        shortcut: "Delete",
        disabled: true,
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
}: BuildApplicationMenusOptions): TopLevelMenu[] {
  return [
    fileMenu(),
    editMenu(),
    viewMenu(viewState, onToggleView),
    insertMenu(),
    projectMenu(),
    helpMenu(onOpenHelpDialog),
  ];
}
