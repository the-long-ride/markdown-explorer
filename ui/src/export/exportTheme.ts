export interface ExportThemeSnapshot {
  rootAttributes: Readonly<Record<string, string>>;
  cssVariables: Readonly<Record<string, string>>;
  cssText: string;
  fontFaceCss: string;
}

const THEME_ATTRIBUTES = ['data-theme', 'data-theme-style', 'data-custom-theme-id'] as const;
const PORTABLE_SELECTOR_MARKERS = [
  '.mdn-',
  '.mermaid',
  '.katex',
  '.hljs',
  '.media-modal',
  '.tooltip-container',
  '.tooltip-text',
];

type RuleWithSelector = CSSRule & { selectorText?: string };
type RuleWithChildren = CSSRule & { cssRules?: CSSRuleList };
type FilteredRule = { cssText: string; fontFaces: string[] };

function escapeAttribute(value: string): string {
  return value.replace(/[&"<>]/g, (character) => ({
    '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;',
  })[character] || character);
}

function isPortableSelector(selector: string): boolean {
  return PORTABLE_SELECTOR_MARKERS.some((marker) => selector.includes(marker));
}

function filterRule(rule: CSSRule): FilteredRule {
  const raw = rule.cssText?.trim() || '';
  if (!raw) return { cssText: '', fontFaces: [] };
  if (/^@font-face\b/i.test(raw)) return { cssText: '', fontFaces: [raw] };
  if (/^@(?:-\w+-)?keyframes\b/i.test(raw)) return { cssText: raw, fontFaces: [] };

  const selector = (rule as RuleWithSelector).selectorText;
  if (typeof selector === 'string') {
    return { cssText: isPortableSelector(selector) ? raw : '', fontFaces: [] };
  }

  const children = (rule as RuleWithChildren).cssRules;
  if (!children) return { cssText: '', fontFaces: [] };
  const filtered = Array.from(children).map(filterRule);
  const childCss = filtered.map((entry) => entry.cssText).filter(Boolean).join('\n');
  const fontFaces = filtered.flatMap((entry) => entry.fontFaces);
  if (!childCss) return { cssText: '', fontFaces };
  const brace = raw.indexOf('{');
  if (brace < 0) return { cssText: '', fontFaces };
  return { cssText: `${raw.slice(0, brace).trim()}{${childCss}}`, fontFaces };
}

function capturePortableStylesheets(doc: Document): { cssText: string; fontFaceCss: string } {
  const css: string[] = [];
  const fontFaces: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        const filtered = filterRule(rule);
        if (filtered.cssText) css.push(filtered.cssText);
        fontFaces.push(...filtered.fontFaces);
      }
    } catch {
      // Cross-origin sheets are intentionally skipped. Export runtime is offline-only.
    }
  }
  return { cssText: css.join('\n'), fontFaceCss: fontFaces.join('\n') };
}

function captureRootVariables(root: HTMLElement): Readonly<Record<string, string>> {
  const values = new Map<string, string>();
  const computed = typeof getComputedStyle === 'function' ? getComputedStyle(root) : null;
  if (computed) {
    for (let index = 0; index < computed.length; index += 1) {
      const name = computed.item(index);
      if (!name.startsWith('--')) continue;
      const value = computed.getPropertyValue(name).trim();
      if (value) values.set(name, value);
    }
  }
  for (let index = 0; index < root.style.length; index += 1) {
    const name = root.style.item(index);
    if (!name.startsWith('--')) continue;
    const value = root.style.getPropertyValue(name).trim();
    if (value) values.set(name, value);
  }
  return Object.fromEntries([...values.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function captureExportThemeSnapshot(root?: HTMLElement): ExportThemeSnapshot {
  const doc = root?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return { rootAttributes: {}, cssVariables: {}, cssText: '', fontFaceCss: '' };
  const target = root ?? doc.documentElement;
  const rootAttributes: Record<string, string> = {};
  for (const name of THEME_ATTRIBUTES) {
    const value = target.getAttribute(name);
    if (value) rootAttributes[name] = value;
  }
  const styles = capturePortableStylesheets(doc);
  return {
    rootAttributes,
    cssVariables: captureRootVariables(target),
    cssText: styles.cssText,
    fontFaceCss: styles.fontFaceCss,
  };
}

export function serializeExportThemeAttributes(theme: ExportThemeSnapshot): string {
  return Object.entries(theme.rootAttributes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
    .join(' ');
}

export function renderExportThemeCss(theme: ExportThemeSnapshot): string {
  const variables = Object.entries(theme.cssVariables)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value};`)
    .join('');
  return [`:root{${variables}}`, theme.fontFaceCss, theme.cssText].filter(Boolean).join('\n');
}
