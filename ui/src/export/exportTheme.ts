export interface ExportThemeSnapshot {
  attributes: Readonly<Record<string, string>>;
  css: string;
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

function escapeAttribute(value: string): string {
  return value.replace(/[&"<>]/g, (character) => ({
    '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;',
  })[character] || character);
}

function isPortableSelector(selector: string): boolean {
  return PORTABLE_SELECTOR_MARKERS.some((marker) => selector.includes(marker));
}

function filterRule(rule: CSSRule): string {
  const cssText = rule.cssText?.trim() || '';
  if (!cssText) return '';
  if (/^@(?:-\w+-)?keyframes\b/i.test(cssText)) return cssText;

  const selector = (rule as RuleWithSelector).selectorText;
  if (typeof selector === 'string') return isPortableSelector(selector) ? cssText : '';

  const children = (rule as RuleWithChildren).cssRules;
  if (!children) return '';
  const filtered = Array.from(children).map(filterRule).filter(Boolean).join('\n');
  if (!filtered) return '';
  const brace = cssText.indexOf('{');
  if (brace < 0) return '';
  return `${cssText.slice(0, brace).trim()}{${filtered}}`;
}

function capturePortableStylesheets(doc: Document): string {
  const rules: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        const filtered = filterRule(rule);
        if (filtered) rules.push(filtered);
      }
    } catch {
      // Cross-origin sheets are intentionally skipped. Export runtime is offline-only.
    }
  }
  return rules.join('\n');
}

function captureRootVariables(root: HTMLElement): string {
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
  return [...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value};`)
    .join('');
}

export function captureExportThemeSnapshot(root?: HTMLElement): ExportThemeSnapshot {
  const doc = root?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return { attributes: {}, css: '' };
  const target = root ?? doc.documentElement;
  const attributes: Record<string, string> = {};
  for (const name of THEME_ATTRIBUTES) {
    const value = target.getAttribute(name);
    if (value) attributes[name] = value;
  }
  const variables = captureRootVariables(target);
  const portableCss = capturePortableStylesheets(doc);
  return {
    attributes,
    css: `:root{${variables}}${portableCss ? `\n${portableCss}` : ''}`,
  };
}

export function serializeExportThemeAttributes(theme: ExportThemeSnapshot): string {
  return Object.entries(theme.attributes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
    .join(' ');
}
