import {
  findDesktopFontFamily,
  type DesktopFontBinding,
  type DesktopFontBindings,
  type DesktopFontFamily,
  type DesktopFontStyle,
  type DesktopFontUsageRole,
} from '../../desktop/fonts/fontModel';

const ROLES: readonly DesktopFontUsageRole[] = ['appUi', 'body', 'heading', 'quote', 'code'];

export interface DesktopTypographyChangeValue {
  readonly family: string;
  readonly style: DesktopFontStyle;
  readonly weight: number;
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
    && a.weight === b.weight;
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
): DesktopTypographyChangeValue {
  const family = findDesktopFontFamily(binding, fonts);
  return {
    family: binding.source === 'default' ? defaultLabel : family?.family ?? binding.family ?? defaultLabel,
    style: binding.style,
    weight: binding.weight,
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
    changes.push({
      role,
      before: displayValue(saved[role], fonts, defaultLabel),
      after: displayValue(draft[role], fonts, defaultLabel),
    });
  }
  return changes;
}
