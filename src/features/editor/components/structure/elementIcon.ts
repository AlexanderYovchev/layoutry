import {
  Box,
  ClipboardList,
  Component,
  FileText,
  Image,
  Layout,
  Menu,
  MousePointerClick,
  PanelBottom,
  PanelTop,
  Type,
  type LucideIcon,
} from "lucide-react";

export const FALLBACK_ELEMENT_ICON = Component;

/** Centralized tag-to-icon mapping for Structure tree rows. */
export const TAG_ICONS: Record<string, LucideIcon> = {
  page: FileText,
  div: Box,
  section: Layout,
  h1: Type,
  h2: Type,
  h3: Type,
  h4: Type,
  h5: Type,
  h6: Type,
  p: Type,
  button: MousePointerClick,
  img: Image,
  nav: Menu,
  header: PanelTop,
  footer: PanelBottom,
  form: ClipboardList,
};
