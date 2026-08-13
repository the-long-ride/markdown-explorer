export type DesktopFontSource = 'default' | 'system' | 'imported';
export type DesktopFontStyle = 'normal' | 'italic';
export type DesktopFontUsageRole = 'appUi' | 'body' | 'heading' | 'quote' | 'code';

export interface DesktopFontSelection {
  readonly source: DesktopFontSource;
  readonly family?: string;
  readonly id?: string;
}

export interface DesktopFontBinding extends DesktopFontSelection {
  readonly style: DesktopFontStyle;
  readonly weight: number;
}

export interface DesktopFontBindings {
  readonly appUi: DesktopFontBinding;
  readonly body: DesktopFontBinding;
  readonly heading: DesktopFontBinding;
  readonly quote: DesktopFontBinding;
  readonly code: DesktopFontBinding;
}

export interface DesktopFontFace {
  readonly style: DesktopFontStyle;
  readonly minWeight: number;
  readonly maxWeight: number;
  readonly variable: boolean;
  readonly cssUrl?: string;
}

export interface DesktopFontFamily {
  readonly id: string;
  readonly family: string;
  readonly source: 'system' | 'imported';
  readonly faces: readonly DesktopFontFace[];
  readonly cssFamily: string;
  readonly available: boolean;
}

export interface DesktopFontVariantOption {
  readonly style: DesktopFontStyle;
  readonly weight: number;
  readonly variable: boolean;
}

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;
const COMMON_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export const DEFAULT_DESKTOP_FONT_BINDINGS: DesktopFontBindings = {
  appUi: { source: 'default', style: 'normal', weight: 400 },
  body: { source: 'default', style: 'normal', weight: 400 },
  heading: { source: 'default', style: 'normal', weight: 700 },
  quote: { source: 'default', style: 'italic', weight: 400 },
  code: { source: 'default', style: 'normal', weight: 400 },
};

function clean(value: unknown, max = 128): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function normalizeWeight(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(1000, Math.round(numeric)));
}

export function normalizeDesktopFontSelection(value: unknown): DesktopFontSelection {
  if (!value || typeof value !== 'object') return { source: 'default' };
  const raw = value as Record<string, unknown>;
  if (raw.source === 'default') return { source: 'default' };
  const family = clean(raw.family);
  if (raw.source === 'system' && family) return { source: 'system', family };
  const id = clean(raw.id, 160);
  if (raw.source === 'imported' && family && id && SAFE_ID.test(id)) {
    return { source: 'imported', family, id };
  }
  return { source: 'default' };
}

export function normalizeDesktopFontBinding(
  value: unknown,
  role: DesktopFontUsageRole,
): DesktopFontBinding {
  const fallback = DEFAULT_DESKTOP_FONT_BINDINGS[role];
  if (!value || typeof value !== 'object') return { ...fallback };
  const raw = value as Record<string, unknown>;
  const selection = normalizeDesktopFontSelection(raw);
  if (selection.source === 'default' && raw.source !== 'default') return { ...fallback };
  const style: DesktopFontStyle = raw.style === 'italic' ? 'italic' : raw.style === 'normal' ? 'normal' : fallback.style;
  const weight = normalizeWeight(raw.weight, fallback.weight);
  return { ...selection, style, weight };
}

function bindingFromLegacy(selection: unknown, role: DesktopFontUsageRole): DesktopFontBinding {
  const normalized = normalizeDesktopFontSelection(selection);
  const fallback = DEFAULT_DESKTOP_FONT_BINDINGS[role];
  return { ...normalized, style: fallback.style, weight: fallback.weight };
}

export function migrateDesktopFontBindings(
  value: unknown,
  legacyAppFont?: unknown,
  legacyCodeFont?: unknown,
): DesktopFontBindings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    appUi: raw.appUi !== undefined
      ? normalizeDesktopFontBinding(raw.appUi, 'appUi')
      : bindingFromLegacy(legacyAppFont, 'appUi'),
    body: raw.body !== undefined
      ? normalizeDesktopFontBinding(raw.body, 'body')
      : bindingFromLegacy(legacyAppFont, 'body'),
    heading: raw.heading !== undefined
      ? normalizeDesktopFontBinding(raw.heading, 'heading')
      : { ...DEFAULT_DESKTOP_FONT_BINDINGS.heading },
    quote: raw.quote !== undefined
      ? normalizeDesktopFontBinding(raw.quote, 'quote')
      : { ...DEFAULT_DESKTOP_FONT_BINDINGS.quote },
    code: raw.code !== undefined
      ? normalizeDesktopFontBinding(raw.code, 'code')
      : bindingFromLegacy(legacyCodeFont, 'code'),
  };
}

function rangeWeights(face: DesktopFontFace): number[] {
  if (!face.variable || face.minWeight === face.maxWeight) return [face.minWeight];
  const weights = new Set<number>([face.minWeight, face.maxWeight]);
  for (const weight of COMMON_WEIGHTS) {
    if (weight >= face.minWeight && weight <= face.maxWeight) weights.add(weight);
  }
  return [...weights].sort((a, b) => a - b);
}

export function getDesktopFontVariantOptions(
  family: DesktopFontFamily | undefined,
): DesktopFontVariantOption[] {
  if (!family?.available) return [];
  const seen = new Set<string>();
  const result: DesktopFontVariantOption[] = [];
  for (const face of family.faces) {
    for (const weight of rangeWeights(face)) {
      const key = `${face.style}:${weight}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ style: face.style, weight, variable: face.variable });
    }
  }
  return result.sort((a, b) => {
    if (a.style !== b.style) return a.style === 'normal' ? -1 : 1;
    return a.weight - b.weight;
  });
}

export function findDesktopFontFamily(
  selection: DesktopFontSelection,
  families: readonly DesktopFontFamily[],
): DesktopFontFamily | undefined {
  if (selection.source === 'system') {
    return families.find(
      (family) => family.source === 'system' && family.family === selection.family,
    );
  }
  if (selection.source === 'imported') {
    return families.find(
      (family) => family.source === 'imported' && family.id === selection.id,
    );
  }
  return undefined;
}
