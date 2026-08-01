import { enhanceRawHtmlImageRows } from '../../markdown/rawHtmlImageRows';
import { getChart, getHighlightJs, getKatex, getMermaid } from '../../lib/renderLibs';
import { syncHtmlPreviewTheme } from './enhancements/htmlPreviewTheme';
import { enhanceMath } from './enhancements/mathRendering';
import { enhanceMermaid } from './enhancements/mermaidRendering';
import { enhanceSyntax } from './enhancements/syntaxHighlighting';
import { enhanceTables } from './enhancements/tableEnhancement';
import { runEnhancementTasks } from './enhancementTasks';

export interface ContentEnhancementOptions {
  body: HTMLElement;
  isDark: boolean;
  isCancelled: () => boolean;
  mermaidRunIdRef: { current: number };
}

export async function runContentEnhancements(options: ContentEnhancementOptions): Promise<void> {
  const { body, isDark, isCancelled, mermaidRunIdRef } = options;
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
      run: () => enhanceMermaid(body, {
        getLibrary: getMermaid,
        isDark,
        isCancelled,
        runIdRef: mermaidRunIdRef,
      }),
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
