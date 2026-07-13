import {
  Blocks,
  FileStack,
  Image,
  ListTree,
  Shapes,
  Star,
  type LucideIcon,
} from "lucide-react";

export type ResourceSectionId =
  | "elements"
  | "components"
  | "templates"
  | "structure"
  | "assets"
  | "favorites";

export interface ResourcePanelSection {
  id: ResourceSectionId;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const resourcePanelSections: ResourcePanelSection[] = [
  {
    id: "elements",
    label: "Elements",
    icon: Shapes,
    description: "This area will contain the complete HTML element library.",
  },
  {
    id: "components",
    label: "Components",
    icon: Blocks,
    description: "This area will contain reusable UI components.",
  },
  {
    id: "templates",
    label: "Templates",
    icon: FileStack,
    description: "This area will contain complete page templates.",
  },
  {
    id: "structure",
    label: "Structure",
    icon: ListTree,
    description: "This area will show the hierarchy of elements on your page.",
  },
  {
    id: "assets",
    label: "Assets",
    icon: Image,
    description: "This area will contain uploaded assets.",
  },
  {
    id: "favorites",
    label: "Favorites",
    icon: Star,
    description: "This area will contain user favorites.",
  },
];
