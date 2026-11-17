// =============================================================================
// chrome/src/markdown-renderer.ts — Wrapper around shared markdown parser/renderer
// =============================================================================

import { parse } from '../../vscode/src/markdown/parser';
import { HtmlRenderer } from '../../vscode/src/markdown/renderer';
import type { Frontmatter, TocEntry } from '../../ui/src/types';

export interface RenderResult {
  html: string;
  frontmatter: Frontmatter;
  toc: TocEntry[];
}

export function renderMarkdown(filePath: string, raw: string, theme = 'dark'): RenderResult {
  const isMdx = filePath.toLowerCase().endsWith('.mdx');
  const parsed = parse(raw, isMdx);
  const renderer = new HtmlRenderer({ theme, isMdx });
  const rendered = renderer.render(parsed.tokens);

  return {
    html: rendered.html,
    frontmatter: parsed.frontmatter as Frontmatter,
    toc: rendered.toc as TocEntry[],
  };
}
