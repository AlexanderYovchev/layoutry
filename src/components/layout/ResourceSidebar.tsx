"use client";

import { useState } from "react";
import { ResourceContextPanel } from "@/components/layout/ResourceContextPanel";
import { ResourceNavigationRail } from "@/components/layout/ResourceNavigationRail";
import {
  resourcePanelSections,
  type ResourceSectionId,
} from "@/components/layout/resourcePanelSections";

export function ResourceSidebar() {
  const [activeSectionId, setActiveSectionId] = useState<ResourceSectionId>(
    resourcePanelSections[0].id,
  );

  const activeSection =
    resourcePanelSections.find((section) => section.id === activeSectionId) ??
    resourcePanelSections[0];

  return (
    <aside
      aria-label="Resource panel"
      className="flex shrink-0 border-r border-zinc-200 dark:border-zinc-800"
    >
      <ResourceNavigationRail
        activeSectionId={activeSectionId}
        onSelect={setActiveSectionId}
      />

      <div className="flex w-52 shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out lg:w-60">
        <ResourceContextPanel section={activeSection} />
      </div>
    </aside>
  );
}
