export interface MenuCommandItem {
  type: "command";
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  premium?: boolean;
  onSelect?: () => void;
}

export interface MenuCheckboxItem {
  type: "checkbox";
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface MenuSeparatorItem {
  type: "separator";
  id: string;
}

export interface MenuSubmenuItem {
  type: "submenu";
  id: string;
  label: string;
  disabled?: boolean;
  items: MenuItem[];
}

export type MenuItem =
  MenuCommandItem | MenuCheckboxItem | MenuSeparatorItem | MenuSubmenuItem;

export interface TopLevelMenu {
  id: string;
  label: string;
  items: MenuItem[];
}
