import {
  DEFAULT_DESKTOP_FONT_BINDINGS,
  findDesktopFontFamily,
  type DesktopFontBinding,
  type DesktopFontBindings,
  type DesktopFontFamily,
  type DesktopFontStyle,
  type DesktopFontUsageRole,
} from '../../desktop/fonts/fontModel';

const ROLES: readonly DesktopFontUsageRole[] = ['appUi', 'body', 'heading', 'quote', 'code', 'mermaid'];

export interface DesktopTypographyChangeValue {
  readonly family: string;
  readonly style: DesktopFontStyle;
  readonly weight: number;
  readonly size: number;
}

export interface DesktopTypographyChange {
  readonly role: DesktopFontUsageRole;
  readonly before: DesktopTypographyChangeValue;
  readonly after: DesktopTypographyChangeValue;
}

function bindingEqual(a: DesktopFontBinding, b: DesktopFontBinding): boolean {
  return a.source === b.source
    && a.family === b.family
    && a.id === b.id
    && a.style === b.style
    && a.weight === b.weight
    && (a.size ?? 13) === (b.size ?? 13);
}

export function desktopTypographyBindingsEqual(
  saved: DesktopFontBindings,
  draft: DesktopFontBindings,
): boolean {
  return ROLES.every((role) => bindingEqual(saved[role], draft[role]));
}

function displayValue(
  binding: DesktopFontBinding,
  fonts: readonly DesktopFontFamily[],
  defaultLabel: string,
  fallbackSize = 13,
): DesktopTypographyChangeValue {
  const family = findDesktopFontFamily(binding, fonts);
  return {
    family: binding.source === 'default' ? defaultLabel : family?.family ?? binding.family ?? defaultLabel,
    style: binding.style,
    weight: binding.weight,
    size: binding.size ?? fallbackSize,
  };
}

export function getDesktopTypographyChanges(
  saved: DesktopFontBindings,
  draft: DesktopFontBindings,
  fonts: readonly DesktopFontFamily[],
  defaultLabel: string,
): DesktopTypographyChange[] {
  const changes: DesktopTypographyChange[] = [];
  for (const role of ROLES) {
    if (bindingEqual(saved[role], draft[role])) continue;
    const fallbackSize = DEFAULT_DESKTOP_FONT_BINDINGS[role].size ?? 13;
    changes.push({
      role,
      before: displayValue(saved[role], fonts, defaultLabel, fallbackSize),
      after: displayValue(draft[role], fonts, defaultLabel, fallbackSize),
    });
  }
  return changes;
}
