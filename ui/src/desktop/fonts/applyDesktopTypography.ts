import {
  DEFAULT_DESKTOP_FONT_BINDINGS,
  findDesktopFontFamily,
  getDesktopFontVariantOptions,
  migrateDesktopFontBindings,
  type DesktopFontBinding,
  type DesktopFontBindings,
  type DesktopFontFamily,
} from './fontModel';

const STYLE_ID = 'markdown-explorer-imported-fonts';
const DEFAULT_UI = '"Be Vietnam Pro", -apple-system, "Segoe UI", system-ui, sans-serif';
const DEFAULT_MONO = '"JetBrains Mono", "Fira Code", Consolas, monospace';

export interface DesktopTypographySelections {
  readonly fontBindings?: DesktopFontBindings;
}

function cssString(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\f]/g, ' ')}"`;
}

function approvedManagedUrl(value?: string) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'file:' || parsed.protocol === 'local-file:' || parsed.protocol === 'vscode-resource:' || parsed.protocol === 'vscode-webview-resource:' || parsed.protocol === 'blob:') return value;
    if (parsed.protocol === 'https:' && /(?:^|\.)vscode-resource\.vscode-cdn\.net$/i.test(parsed.hostname)) return value;
    return undefined;
  } catch {
    return undefined;
  }
}

function bindingIsAvailable(binding: DesktopFontBinding, family: DesktopFontFamily | undefined) {
  if (!family?.available) return false;
  return getDesktopFontVariantOptions(family).some(
    (option) => option.style === binding.style && option.weight === binding.weight,
  );
}

function resolveBinding(
  binding: DesktopFontBinding,
  families: readonly DesktopFontFamily[],
  fallbackCss: string,
  fallback: DesktopFontBinding,
) {
  if (binding.source === 'default') {
    return { css: fallbackCss, family: undefined, style: binding.style, weight: binding.weight };
  }
  const family = findDesktopFontFamily(binding, families);
  if (!bindingIsAvailable(binding, family)) {
    return { css: fallbackCss, family: undefined, style: fallback.style, weight: fallback.weight };
  }
  return {
    css: `${cssString(family!.cssFamily)}, ${fallbackCss}`,
    family,
    style: binding.style,
    weight: binding.weight,
  };
}

function registerImported(doc: Document, families: readonly DesktopFontFamily[]) {
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  const unique = [...new Map(
    families
      .filter((family) => family.source === 'imported')
      .map((family) => [family.id, family]),
  ).values()];
  style.textContent = unique.flatMap((family) => family.faces.flatMap((face) => {
    const url = approvedManagedUrl(face.cssUrl);
    if (!url) return [];
    const safeUrl = url
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/[\r\n\f]/g, '');
    const weight = face.minWeight === face.maxWeight
      ? String(face.minWeight)
      : `${face.minWeight} ${face.maxWeight}`;
    const formatHint = url.startsWith('blob:')
      ? ''
      : ` format("${url.toLowerCase().includes('.otf') ? 'opentype' : 'truetype'}")`;
    return [
      `@font-face{font-family:${cssString(family.cssFamily)};src:url("${safeUrl}")${formatHint};font-style:${face.style};font-weight:${weight};font-display:swap;}`,
    ];
  })).join('\n');
}

const ROLE_VARIABLES = {
  appUi: ['--font-ui', '--font-ui-style', '--font-ui-weight'],
  body: ['--font-body', '--font-body-style', '--font-body-weight'],
  heading: ['--font-heading', '--font-heading-style', '--font-heading-weight'],
  quote: ['--font-quote', '--font-quote-style', '--font-quote-weight'],
  code: ['--font-mono', '--font-mono-style', '--font-mono-weight'],
  mermaid: ['--font-mermaid', '--font-mermaid-style', '--font-mermaid-weight'],
} as const;

export function applyDesktopTypography(
  doc: Document,
  settings: DesktopTypographySelections,
  families: readonly DesktopFontFamily[],
  enabled: boolean,
) {
  const targets = [doc.documentElement, doc.body].filter((target): target is HTMLElement => Boolean(target));
  const allVariables = Object.values(ROLE_VARIABLES).flat();
  if (!enabled) {
    targets.forEach((target) => allVariables.forEach((name) => target.style.removeProperty(name)));
    doc.getElementById(STYLE_ID)?.remove();
    return;
  }

  const bindings = migrateDesktopFontBindings(settings.fontBindings);
  const resolved = {
    appUi: resolveBinding(bindings.appUi, families, DEFAULT_UI, DEFAULT_DESKTOP_FONT_BINDINGS.appUi),
    body: resolveBinding(bindings.body, families, DEFAULT_UI, DEFAULT_DESKTOP_FONT_BINDINGS.body),
    heading: resolveBinding(bindings.heading, families, DEFAULT_UI, DEFAULT_DESKTOP_FONT_BINDINGS.heading),
    quote: resolveBinding(bindings.quote, families, DEFAULT_UI, DEFAULT_DESKTOP_FONT_BINDINGS.quote),
    code: resolveBinding(bindings.code, families, DEFAULT_MONO, DEFAULT_DESKTOP_FONT_BINDINGS.code),
    mermaid: resolveBinding(bindings.mermaid, families, DEFAULT_UI, DEFAULT_DESKTOP_FONT_BINDINGS.mermaid),
  };

  registerImported(
    doc,
    Object.values(resolved)
      .map((item) => item.family)
      .filter((font): font is DesktopFontFamily => Boolean(font)),
  );

  targets.forEach((target) => {
    for (const [role, item] of Object.entries(resolved) as [keyof typeof resolved, (typeof resolved)[keyof typeof resolved]][]) {
      const [familyVar, styleVar, weightVar] = ROLE_VARIABLES[role];
      target.style.setProperty(familyVar, item.css);
      target.style.setProperty(styleVar, item.style);
      target.style.setProperty(weightVar, String(item.weight));
    }
  });
}
