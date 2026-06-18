export interface ToolbarMenuItemsArgs {
  labels: {
    home: string;
    theme: string;
    edit: string;
    settings: string;
  };
  tooltips: {
    home: string;
    theme: string;
    edit: string;
    settings: string;
  };
  shortcuts?: Partial<Record<"home" | "theme" | "edit" | "settings", string>>;
  canEdit?: boolean;
}

export interface ToolbarMenuItem {
  id: "home" | "theme" | "edit" | "settings";
  label: string;
  tooltip: string;
  disabled: boolean;
}

export function formatToolbarShortcutLabel(shortcut: string): string;
export function buildShortcutTooltip(tooltip: string, shortcut?: string): string;
export function createToolbarMenuItems(args: ToolbarMenuItemsArgs): ToolbarMenuItem[];
