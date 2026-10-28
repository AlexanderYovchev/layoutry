"use client";

import { useState } from "react";
import { MenuBarRoot } from "@/components/ui/menu/MenuBarRoot";
import { MenuBarTrigger } from "@/components/ui/menu/MenuBarTrigger";
import {
  buildApplicationMenus,
  type EditMenuCommands,
  type FileMenuCommands,
  type HelpDialogId,
  type ViewState,
} from "@/components/layout/applicationMenus";
import { LayoutryLogoMark } from "@/components/layout/LayoutryLogoMark";
import { ProjectIdentity, type ProjectIdentityInfo } from "@/components/layout/ProjectIdentity";
import { GlobalActions, type HistoryControl, type PreviewControl } from "@/components/layout/GlobalActions";
import { HelpDialogs } from "@/components/layout/HelpDialogs";

interface AppHeaderProps {
  viewState: ViewState;
  onToggleView: (region: keyof ViewState) => void;
  editMenuCommands: EditMenuCommands;
  previewControl: PreviewControl;
  fileMenuCommands?: FileMenuCommands;
  project?: ProjectIdentityInfo;
}

export function AppHeader({
  viewState,
  onToggleView,
  editMenuCommands,
  previewControl,
  fileMenuCommands,
  project,
}: AppHeaderProps) {
  const [openDialogId, setOpenDialogId] = useState<HelpDialogId | null>(null);

  const menus = buildApplicationMenus({
    viewState,
    onToggleView,
    onOpenHelpDialog: setOpenDialogId,
    editMenuCommands,
    fileMenuCommands,
  });

  // Checkpoint 1.15.6.10.2 — the exact same canUndo/canRedo/onUndo/onRedo
  // values already feeding the Edit menu above, just narrowed to
  // GlobalActions' own minimal HistoryControl shape rather than handing it
  // the whole EditMenuCommands object (which also carries Cut/Copy/Paste/
  // Duplicate/Delete — irrelevant to a plain Undo/Redo toolbar control).
  // One source of truth, two consumers.
  const historyControl: HistoryControl = {
    canUndo: editMenuCommands.canUndo,
    canRedo: editMenuCommands.canRedo,
    onUndo: editMenuCommands.onUndo,
    onRedo: editMenuCommands.onRedo,
  };

  return (
    <>
      <header
        aria-label="Application menu bar"
        className="flex h-13 shrink-0 items-center gap-4 border-b border-line bg-surface-header px-4 max-lg:gap-2 max-lg:px-3"
      >
        <h1 className="flex shrink-0 items-center gap-2 text-xl font-bold tracking-tight text-fg-primary">
          <LayoutryLogoMark className="size-6.5 shrink-0" />
          Layoutry
        </h1>

        <MenuBarRoot
          aria-label="Application menu"
          menuIds={menus.map((menu) => menu.id)}
        >
          {menus.map((menu) => (
            <MenuBarTrigger
              key={menu.id}
              id={menu.id}
              label={menu.label}
              items={menu.items}
            />
          ))}
        </MenuBarRoot>

        <ProjectIdentity project={project} />

        <GlobalActions
          historyControl={historyControl}
          previewControl={previewControl}
          onExportCode={fileMenuCommands?.onExportCode}
        />
      </header>

      <HelpDialogs
        openDialogId={openDialogId}
        onClose={() => setOpenDialogId(null)}
      />
    </>
  );
}
