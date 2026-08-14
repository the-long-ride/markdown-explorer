import { chooseNeutralMermaidForeground } from './mermaidContrast.ts';
import type { MermaidThemeTokens } from './mermaidTheme.ts';

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function extractZenUmlTitle(source: string): string | null {
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^title\s+(.+)$/i);
    if (!match) continue;
    const title = match[1].trim();
    if (
      title.length >= 2
      && ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'")))
    ) return normalizeText(title.slice(1, -1));
    return normalizeText(title);
  }
  return null;
}

function applyTitleStyle(element: Element, foreground: string, fontFamily: string): void {
  const styled = element as HTMLElement & SVGElement;
  if (styled.style) {
    styled.style.fontFamily = fontFamily;
    styled.style.color = foreground;
    styled.style.fill = foreground;
    styled.style.setProperty?.('font-family', fontFamily, 'important');
    styled.style.setProperty?.('color', foreground, 'important');
    styled.style.setProperty?.('fill', foreground, 'important');
  }
  element.setAttribute?.('fill', foreground);
  element.setAttribute?.('data-mdn-zenuml-title', 'true');

  element.querySelectorAll?.('*').forEach((child) => {
    const childElement = child as HTMLElement & SVGElement;
    if (!childElement.style) return;
    childElement.style.fontFamily = fontFamily;
    childElement.style.color = foreground;
    childElement.style.fill = foreground;
    childElement.style.setProperty?.('font-family', fontFamily, 'important');
    childElement.style.setProperty?.('color', foreground, 'important');
    childElement.style.setProperty?.('fill', foreground, 'important');
  });
}

export function enforceZenUmlFont(svg: SVGSVGElement, fontFamily: string): void {
  if (typeof svg.querySelectorAll !== 'function') return;
  svg.querySelectorAll<HTMLElement & SVGElement>('text, tspan, foreignObject, foreignObject *').forEach((element) => {
    if (!element?.style) return;
    element.style.fontFamily = fontFamily;
    element.style.setProperty?.('font-family', fontFamily, 'important');
  });
}

export function repairZenUmlTitle(
  svg: SVGSVGElement,
  tokens: MermaidThemeTokens,
  fontFamily: string,
  source: string,
): boolean {
  const title = extractZenUmlTitle(source);
  if (!title || typeof svg.querySelectorAll !== 'function') return false;

  const candidates = [...svg.querySelectorAll<Element>('text, foreignObject')];
  const titleElement = candidates.find((candidate) => normalizeText(candidate.textContent) === title);
  if (!titleElement) return false;

  const foreground = chooseNeutralMermaidForeground(tokens.background, tokens);
  applyTitleStyle(titleElement, foreground, fontFamily);
  return true;
}
