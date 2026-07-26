"use client";

import { useState } from "react";
import { MenuBarRoot } from "@/components/ui/menu/MenuBarRoot";
import { MenuBarTrigger } from "@/components/ui/menu/MenuBarTrigger";
import {
  buildApplicationMenus,
  type EditMenuCommands,
  type HelpDialogId,
  type ViewState,
} from "@/components/layout/applicationMenus";
import { ProjectIdentity } from "@/components/layout/ProjectIdentity";
import { GlobalActions } from "@/components/layout/GlobalActions";
import { HelpDialogs } from "@/components/layout/HelpDialogs";

interface AppHeaderProps {
  viewState: ViewState;
  onToggleView: (region: keyof ViewState) => void;
  editMenuCommands: EditMenuCommands;
}

export function AppHeader({ viewState, onToggleView, editMenuCommands }: AppHeaderProps) {
  const [openDialogId, setOpenDialogId] = useState<HelpDialogId | null>(null);

  const menus = buildApplicationMenus({
    viewState,
    onToggleView,
    onOpenHelpDialog: setOpenDialogId,
    editMenuCommands,
  });

  return (
    <>
      <header
        aria-label="Application menu bar"
        className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-black"
      >
        <h1 className="shrink-0 text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
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

        <ProjectIdentity />

        <GlobalActions />
      </header>

      <HelpDialogs
        openDialogId={openDialogId}
        onClose={() => setOpenDialogId(null)}
      />
    </>
  );
}
