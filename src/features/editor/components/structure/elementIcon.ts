import {
  Box,
  ClipboardList,
  Component,
  FileText,
  Image,
  Layout,
  Link,
  Menu,
  MousePointerClick,
  PanelBottom,
  PanelTop,
  Rows3,
  Type,
  type LucideIcon,
} from "lucide-react";

export const FALLBACK_ELEMENT_ICON = Component;

/** Centralized tag-to-icon mapping for Structure tree rows. */
export const TAG_ICONS: Record<string, LucideIcon> = {
  page: FileText,
  body: Rows3,
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
  a: Link,
  nav: Menu,
  header: PanelTop,
  footer: PanelBottom,
  form: ClipboardList,
};
