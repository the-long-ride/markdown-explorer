import { enhanceRawHtmlImageRows } from '../../markdown/rawHtmlImageRows';
import { getChart, getHighlightJs, getKatex, getMermaid } from '../../lib/renderLibs';
import { syncHtmlPreviewTheme } from './enhancements/htmlPreviewTheme';
import { enhanceMath } from './enhancements/mathRendering';
import { enhanceMermaidLazily } from './enhancements/mermaidLazyRendering';
import { resolveMermaidCacheSignature } from './enhancements/mermaidSvgCache';
import { enhanceSyntax } from './enhancements/syntaxHighlighting';
import { enhanceTables } from './enhancements/tableEnhancement';
import { runEnhancementTasks } from './enhancementTasks';

export interface ContentEnhancementOptions {
  body: HTMLElement;
  isDark: boolean;
  isCancelled: () => boolean;
  mermaidRunIdRef: { current: number };
  /** Scroll container of the document root; orders lazy Mermaid rendering. */
  scroll?: Element | null;
}

export async function runContentEnhancements(options: ContentEnhancementOptions): Promise<void> {
  const { body, isDark, isCancelled, mermaidRunIdRef, scroll } = options;
  enhanceRawHtmlImageRows(body);

  await runEnhancementTasks([
    {
      label: 'Highlight',
      run: () => enhanceSyntax(body, getHighlightJs),
    },
    {
      label: 'KaTeX load',
      run: () => enhanceMath(body, getKatex),
    },
    {
      label: 'Mermaid',
      run: () => enhanceMermaidLazily(body, {
        getLibrary: getMermaid,
        isDark,
        isCancelled,
        runIdRef: mermaidRunIdRef,
        // Resolved theme variables, read when the pass starts, so another theme
        // (mode, style or custom palette) never reuses stale diagram colors.
        cacheSignature: resolveMermaidCacheSignature(document, isDark),
      }, { scroll }),
    },
    {
      label: 'Table enhancement',
      run: () => {
        const tableGlobals = (window as typeof window & { Table?: any }).Table;
        return enhanceTables(body, { getChart, tableGlobals });
      },
    },
  ], isCancelled);

  if (isCancelled()) return;
  syncHtmlPreviewTheme(body, isDark);
}
