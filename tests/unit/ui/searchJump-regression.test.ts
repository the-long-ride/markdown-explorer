import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMarkdownClientSide } from '../../../ui/src/contexts/contentTabState';
import { HEADING_SECTION_STATE_CHANGE_EVENT } from '../../../ui/src/dom/headingSectionHandlers';
import {
  clearSearchJumpMarks,
  scrollToRenderedSearchMatchInRoot,
  SEARCH_JUMP_MARK_CLASS,
  SEARCH_JUMP_TARGET_CLASS,
} from '../../../ui/src/utils/searchJump';
import {
  deriveMarkdownStrippedQuery,
  rawOffsetToNormalizedOffset,
  resolveNormalizedSourceTarget,
  utf8ByteOffsetToUtf16,
} from '../../../ui/src/utils/searchJumpResolver';

function renderIntoContainer(markdown: string, filePath = 'manual-tests/test-general.md'): HTMLDivElement {
  const rendered = renderMarkdownClientSide(markdown, filePath, false);
  const scroll = document.createElement('div');
  scroll.className = 'content__scroll';
  const body = document.createElement('div');
  body.className = 'mdn-body';
  body.innerHTML = rendered.html;
  scroll.appendChild(body);
  document.body.appendChild(scroll);
  return body;
}

describe('searchJumpResolver pure helpers', () => {
  it('converts UTF-8 byte offsets with emojis and multibyte characters to UTF-16 offsets', () => {
    const text = '# 🧪 Test: café — Việt Nam';
    const utf16Test = text.indexOf('Test');
    const utf8Test = new TextEncoder().encode(text.slice(0, utf16Test)).length;
    expect(utf8ByteOffsetToUtf16(text, utf8Test)).toBe(utf16Test);

    const utf16Nam = text.indexOf('Nam');
    const utf8Nam = new TextEncoder().encode(text.slice(0, utf16Nam)).length;
    expect(utf8ByteOffsetToUtf16(text, utf8Nam)).toBe(utf16Nam);
  });

  it('converts CRLF offsets to LF-normalized offsets', () => {
    const raw = 'line1\r\nline2\r\ntarget';
    const rawTarget = raw.indexOf('target');
    const lf = raw.replace(/\r\n/g, '\n');
    expect(rawOffsetToNormalizedOffset(raw, rawTarget)).toBe(lf.indexOf('target'));
  });

  it('strips markdown syntax from search queries while keeping readable text', () => {
    expect(deriveMarkdownStrippedQuery('# 🧪 Test: 1000-Row Telemetry Table')).toBe('🧪 Test: 1000-Row Telemetry Table');
    expect(deriveMarkdownStrippedQuery('| Experiments | Sam | $15,000 | $9,850 |')).toBe('Experiments Sam $15,000 $9,850');
    expect(deriveMarkdownStrippedQuery('**1 000 rows** of `synthetic`')).toBe('1 000 rows of synthetic');
    expect(deriveMarkdownStrippedQuery('<https://example.com/report?utm_medium=test>')).toBe('https://example.com/report?utm_medium=test');
    expect(deriveMarkdownStrippedQuery('[Interactive MDX](./test-mdx.mdx)')).toBe('Interactive MDX');
  });

  it('resolves the exact normalized offset from lineNumber even under CRLF and UTF-8 drift', () => {
    const raw = '# 🧪 Header\r\n| A | B |\r\n|---|---|\r\n| Experiments | Testing |\r\nFooter test';
    const target = resolveNormalizedSourceTarget(raw, 'test', false, 0, 999, { lineNumber: 4 });
    expect(target).not.toBeNull();
    expect(target!.lineIndex).toBe(3);
    expect(target!.normalizedSource.slice(target!.normalizedOffset, target!.normalizedOffset + 4)).toBe('Test');
  });
});

describe('scrollToRenderedSearchMatchInRoot normal-view regressions', () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.useRealTimers();
  });

  it('jumps to the exact table row (test-general.md line 343 pattern) after mermaid blocks instead of later matches', () => {
    const lines = [
      '# Marketing Campaign',
      '',
      '> A comprehensive Markdown rendering stress test.',
      '',
      '```mermaid',
      'quadrantChart',
      '  title Channel Priority',
      '  quadrant-4 Test carefully',
      '  "Paid Search": [0.78, 0.82]',
      '```',
      '',
      '## 4. Budget and Performance Data',
      '',
      '| Channel | Owner | Budget | Spend | Status |',
      '|:--|:--|--:|--:|:--|',
      '| Paid Search | Mina | $150,000 | $142,500 | Active |',
      '| Paid Social | Andre | $105,000 | $98,750 | Active |',
      '| Experiments | Sam | $15,000 | $9,850 | Testing |',
      '| Organic Content | Hana | $0 | $0 | Evergreen |',
      '',
      'A URL with query parameters: <https://example.com/report?campaign=aurora&utm_source=docs&utm_medium=test>.',
      '',
      '**End of general marketing campaign rendering test.**',
    ];
    const markdown = lines.join('\r\n');
    const body = renderIntoContainer(markdown);

    // Simulate Mermaid rendering turning the mermaid block into an SVG (skipped by text walker).
    const mermaidDiv = body.querySelector('.mermaid');
    if (mermaidDiv) {
      mermaidDiv.innerHTML = '<svg><text>quadrant-4 Test carefully</text></svg>';
    }

    const rowLineNumber = lines.findIndex((line) => line.includes('| Experiments |')) + 1;
    const rawUtf16Index = markdown.indexOf('Testing');
    const tauriUtf8ByteIndex = new TextEncoder().encode(markdown.slice(0, rawUtf16Index)).length;

    const ok = scrollToRenderedSearchMatchInRoot(
      body,
      'test',
      3,
      tauriUtf8ByteIndex,
      markdown,
      false,
      { lineNumber: rowLineNumber, excerpt: lines[rowLineNumber - 1] },
    );

    expect(ok).toBe(true);
    const active = body.querySelector<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`);
    expect(active).not.toBeNull();
    expect(active?.textContent).toBe('Test');
    expect(active?.closest('tr')?.textContent).toContain('Experiments');
    expect(active?.closest('tr')?.textContent).toContain('Sam');
    expect(active?.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });

    // Other matches in the document are marked secondary.
    expect(body.querySelectorAll('mark.mdn-search-jump-mark-secondary').length).toBeGreaterThanOrEqual(3);
  });

  it('matches multi-cell markdown table row queries containing pipe syntax', () => {
    const markdown = [
      '| Channel | Owner | Budget | Spend | Status |',
      '|:--|:--|--:|--:|:--|',
      '| Experiments | Sam | $15,000 | $9,850 | Testing |',
    ].join('\n');
    const body = renderIntoContainer(markdown);

    const ok = scrollToRenderedSearchMatchInRoot(
      body,
      '| Experiments | Sam | $15,000 | $9,850 |',
      0,
      markdown.indexOf('| Experiments'),
      markdown,
      false,
      { lineNumber: 3 },
    );

    expect(ok).toBe(true);
    const marks = [...body.querySelectorAll<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`)];
    expect(marks.map((m) => m.textContent)).toEqual(['Experiments', 'Sam', '$15,000', '$9,850']);
  });

  it('distinguishes repeated identical values inside the same table row', () => {
    const markdown = [
      '| Channel | Owner | Budget | Spend |',
      '|:--|:--|--:|--:|',
      '| Organic Content | Hana | $0 | $0 |',
    ].join('\n');
    const body = renderIntoContainer(markdown);
    const firstIdx = markdown.indexOf('$0');
    const secondIdx = markdown.indexOf('$0', firstIdx + 2);

    expect(scrollToRenderedSearchMatchInRoot(body, '$0', 0, firstIdx, markdown, false, { lineNumber: 3 })).toBe(true);
    const firstActiveCell = body.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)?.closest('td');
    expect(firstActiveCell?.cellIndex).toBe(2);

    expect(scrollToRenderedSearchMatchInRoot(body, '$0', 1, secondIdx, markdown, false, { lineNumber: 3 })).toBe(true);
    const secondActiveCell = body.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)?.closest('td');
    expect(secondActiveCell?.cellIndex).toBe(3);
  });

  it('jumps to emoji heading line 1 and expands collapsed rows in a large table', () => {
    const rows = Array.from({ length: 28 }, (_, index) => (
      `| ${index + 1} | 2024-01-${String(index + 1).padStart(2, '0')} | \`EVT-${String(index + 1).padStart(4, '0')}\` — trace drift | ${index % 2 === 0 ? 'Alpha' : 'Beta'} |`
    ));
    const markdown = [
      '# 🧪 Test: 1000-Row Telemetry Table',
      '',
      '> [!NOTE]',
      '> **1 000 rows** of synthetic telemetry.',
      '',
      '| Index | Date | Event Signature | Category |',
      '| --- | --- | --- | --- |',
      ...rows,
    ].join('\n');
    const body = renderIntoContainer(markdown, 'manual-tests/test-large-table.md');

    // Line 1 with Tauri UTF-8 byte offset (4-byte emoji shifts index from 5 to 7).
    const utf8Offset = new TextEncoder().encode('# 🧪 ').length;
    expect(scrollToRenderedSearchMatchInRoot(body, 'Test', 0, utf8Offset, markdown, false, { lineNumber: 1 })).toBe(true);
    const headingMark = body.querySelector<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`);
    expect(headingMark?.closest('h1')).not.toBeNull();

    // Line 1 with markdown heading syntax.
    expect(scrollToRenderedSearchMatchInRoot(body, '# 🧪 Test: 1000-Row Telemetry Table', 0, 0, markdown, false, { lineNumber: 1 })).toBe(true);
    expect(body.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)?.closest('h1')).not.toBeNull();

    // Collapsed row 25 (index 24, >= TABLE_COLLAPSE_LIMIT=15) with repeated "Alpha".
    const targetRowLine = 7 + 25; // 7 header/preamble lines + 25th data row (1-based)
    const collapsedRowBefore = body.querySelectorAll('tbody tr')[24];
    expect(collapsedRowBefore.classList.contains('is-collapsed-row')).toBe(true);

    expect(scrollToRenderedSearchMatchInRoot(body, 'Alpha', undefined, undefined, markdown, false, { lineNumber: targetRowLine })).toBe(true);
    const rowMark = body.querySelector<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`);
    expect(rowMark?.closest('tr')).toBe(collapsedRowBefore);
    expect(collapsedRowBefore.classList.contains('is-collapsed-row')).toBe(false);

    // Inline formatted query across <strong> and text node.
    expect(scrollToRenderedSearchMatchInRoot(body, '**1 000 rows** of synthetic', 0, markdown.indexOf('**1 000 rows**'), markdown, false, { lineNumber: 4 })).toBe(true);
    const boldMarks = [...body.querySelectorAll(`mark.${SEARCH_JUMP_MARK_CLASS}`)];
    expect(boldMarks.map((m) => m.textContent).join('')).toBe('1 000 rows of synthetic');

    // Inline code + text inside a table cell.
    expect(scrollToRenderedSearchMatchInRoot(body, '`EVT-0020` — trace drift', 0, markdown.indexOf('`EVT-0020`'), markdown, false, { lineNumber: 7 + 20 })).toBe(true);
    expect(body.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)?.closest('tr')?.textContent).toContain('EVT-0020');
  });

  it('highlights the mermaid wrapper when matching text inside a rendered mermaid SVG', () => {
    const markdown = [
      '# Diagrams',
      '',
      '```mermaid',
      'quadrantChart',
      '  quadrant-4 Test carefully',
      '```',
      '',
      'Unrelated footer test.',
    ].join('\n');
    const body = renderIntoContainer(markdown);
    const mermaid = body.querySelector('.mermaid');
    if (mermaid) mermaid.innerHTML = '<svg><text>quadrant-4 Test carefully</text></svg>';

    const ok = scrollToRenderedSearchMatchInRoot(body, 'Test', 0, markdown.indexOf('Test carefully'), markdown, false, { lineNumber: 5 });
    expect(ok).toBe(true);
    const target = body.querySelector<HTMLElement>(`.${SEARCH_JUMP_TARGET_CLASS}`);
    expect(target?.classList.contains('mdn-mermaid-wrap')).toBe(true);
    expect(target?.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    // Must not falsely highlight the unrelated footer "test".
    expect(body.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)).toBeNull();

    clearSearchJumpMarks(body);
    expect(body.querySelector(`.${SEARCH_JUMP_TARGET_CLASS}`)).toBeNull();
  });

  it('expands collapsed heading sections, collapsed code blocks, details, and HTML preview blocks', () => {
    const longCode = Array.from({ length: 25 }, (_, i) => (
      i === 22 ? 'const targetSymbol = computeValue();' : `const line${i} = ${i};`
    )).join('\n');
    const markdown = [
      '# Outer Section',
      '',
      '## Inner Section',
      '',
      '```ts',
      longCode,
      '```',
      '',
      '```html',
      '<div class="preview-demo">HiddenHtmlToken</div>',
      '```',
      '',
      'Link: <https://example.com/report?utm_medium=test>',
    ].join('\n');
    const body = renderIntoContainer(markdown);

    // Collapse all sections first.
    body.querySelectorAll<HTMLElement>('.mdn-section').forEach((section) => {
      section.setAttribute('data-expanded', 'false');
      section.querySelector('.mdn-section-header')?.setAttribute('aria-expanded', 'false');
    });
    const sectionEvents: Event[] = [];
    const onSectionChange = (e: Event) => sectionEvents.push(e);
    window.addEventListener(HEADING_SECTION_STATE_CHANGE_EVENT, onSectionChange);

    const codeLineNumber = 5 + 23; // fence on line 5, line index 22 is line 28
    const ok = scrollToRenderedSearchMatchInRoot(
      body,
      'const targetSymbol =',
      0,
      markdown.indexOf('const targetSymbol ='),
      markdown,
      false,
      { lineNumber: codeLineNumber },
    );
    window.removeEventListener(HEADING_SECTION_STATE_CHANGE_EVENT, onSectionChange);

    expect(ok).toBe(true);
    body.querySelectorAll<HTMLElement>('.mdn-section').forEach((section) => {
      expect(section.getAttribute('data-expanded')).toBe('true');
      expect(section.querySelector('.mdn-section-header')?.getAttribute('aria-expanded')).toBe('true');
    });
    expect(sectionEvents.length).toBeGreaterThanOrEqual(2);

    const tsBlock = body.querySelector<HTMLElement>('.mdn-codeblock');
    expect(tsBlock?.dataset.collapsed).toBe('false');
    const codeMarks = [...body.querySelectorAll(`mark.${SEARCH_JUMP_MARK_CLASS}`)];
    expect(codeMarks.map((m) => m.textContent).join('')).toBe('const targetSymbol =');

    // HTML code block currently in preview mode switches to code mode to reveal source match.
    const htmlLineNumber = markdown.slice(0, markdown.indexOf('HiddenHtmlToken')).split('\n').length;
    expect(scrollToRenderedSearchMatchInRoot(body, 'HiddenHtmlToken', 0, markdown.indexOf('HiddenHtmlToken'), markdown, false, { lineNumber: htmlLineNumber })).toBe(true);
    const htmlWrap = body.querySelector<HTMLElement>('.mdn-html-preview-wrap');
    expect(htmlWrap?.dataset.mode).toBe('code');
    expect(body.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)?.textContent).toBe('HiddenHtmlToken');

    // Angle-bracket autolink matches across rendered text & <a>.
    const urlLineNumber = markdown.slice(0, markdown.indexOf('utm_medium=test')).split('\n').length;
    expect(scrollToRenderedSearchMatchInRoot(body, '<https://example.com/report?utm_medium=test>', 0, markdown.indexOf('<https://'), markdown, false, { lineNumber: urlLineNumber })).toBe(true);
    const urlMarks = [...body.querySelectorAll(`mark.${SEARCH_JUMP_MARK_CLASS}`)];
    expect(urlMarks.map((m) => m.textContent).join('')).toBe('<https://example.com/report?utm_medium=test>');
    expect(urlMarks.some((m) => Boolean(m.closest('a')))).toBe(true);

    // Closed <details> opens when a match is inside it.
    const details = document.createElement('details');
    details.innerHTML = '<summary>Meta</summary><p>SecretPropertyValue</p>';
    body.appendChild(details);
    expect(details.open).toBe(false);
    expect(scrollToRenderedSearchMatchInRoot(body, 'SecretPropertyValue')).toBe(true);
    expect(details.open).toBe(true);
  });

  it('jumps accurately to every "test" result in real manual-tests/test-general.md and manual-tests/test-large-table.md', () => {
    const generalRaw = readFileSync(resolve(process.cwd(), 'manual-tests/test-general.md'), 'utf8');
    const generalBody = renderIntoContainer(generalRaw, 'manual-tests/test-general.md');
    // Simulate Mermaid rendering converting mermaid code blocks into SVGs.
    generalBody.querySelectorAll('.mermaid').forEach((node) => {
      node.innerHTML = `<svg><text>${node.textContent ?? ''}</text></svg>`;
    });

    const generalLines = generalRaw.replace(/\r\n/g, '\n').split('\n');
    const line343Index = generalLines.findIndex((line) => line.includes('| Experiments | Sam |'));
    expect(line343Index).toBeGreaterThan(0);

    // Line 343: | Experiments | Sam | $15,000 | $9,850 | ... | Testing |
    const rawTestingIdx = generalRaw.indexOf('Testing');
    const utf8TestingIdx = new TextEncoder().encode(generalRaw.slice(0, rawTestingIdx)).length;
    expect(
      scrollToRenderedSearchMatchInRoot(
        generalBody,
        'test',
        3,
        utf8TestingIdx,
        generalRaw,
        false,
        { lineNumber: line343Index + 1, excerpt: generalLines[line343Index] },
      ),
    ).toBe(true);
    const activeGeneral = generalBody.querySelector<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`);
    expect(activeGeneral?.textContent).toBe('Test');
    expect(activeGeneral?.closest('tr')?.textContent).toContain('Experiments');
    expect(activeGeneral?.closest('tr')?.textContent).toContain('$15,000');

    // Line 310: quadrant-4 Test carefully (inside rendered Mermaid SVG)
    const mermaidLine = generalLines.findIndex((line) => line.includes('quadrant-4 Test carefully')) + 1;
    expect(mermaidLine).toBeGreaterThan(0);
    expect(
      scrollToRenderedSearchMatchInRoot(
        generalBody,
        'test',
        2,
        generalRaw.indexOf('Test carefully'),
        generalRaw,
        false,
        { lineNumber: mermaidLine },
      ),
    ).toBe(true);
    expect(generalBody.querySelector<HTMLElement>(`.${SEARCH_JUMP_TARGET_CLASS}`)?.classList.contains('mdn-mermaid-wrap')).toBe(true);

    // Line 1284: final paragraph
    const footerLine = generalLines.findIndex((line) => line.includes('rendering test.')) + 1;
    expect(
      scrollToRenderedSearchMatchInRoot(
        generalBody,
        'test',
        5,
        generalRaw.lastIndexOf('test'),
        generalRaw,
        false,
        { lineNumber: footerLine },
      ),
    ).toBe(true);
    expect(generalBody.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)?.closest('p')?.textContent).toContain('End of general marketing campaign');

    generalBody.parentElement?.remove();

    // Real manual-tests/test-large-table.md (1000-row table + callout + emoji H1)
    const largeRaw = readFileSync(resolve(process.cwd(), 'manual-tests/test-large-table.md'), 'utf8');
    const largeBody = renderIntoContainer(largeRaw, 'manual-tests/test-large-table.md');

    // Line 1: # 🧪 Test: 1000-Row Telemetry Table (must not be hijacked by callout's relative offset 0)
    const utf8Line1Test = new TextEncoder().encode('# 🧪 ').length;
    expect(
      scrollToRenderedSearchMatchInRoot(
        largeBody,
        'test',
        0,
        utf8Line1Test,
        largeRaw,
        false,
        { lineNumber: 1 },
      ),
    ).toBe(true);
    expect(largeBody.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)?.closest('h1')?.textContent).toContain('1000-Row Telemetry Table');

    // Collapsed row 500 in the 1000-row table
    const largeLines = largeRaw.replace(/\r\n/g, '\n').split('\n');
    const row500Line = largeLines.findIndex((line) => /^\|\s*500\s*\|/.test(line)) + 1;
    expect(row500Line).toBeGreaterThan(500);
    const row500El = largeBody.querySelectorAll('tbody tr')[499];
    expect(row500El.classList.contains('is-collapsed-row')).toBe(true);
    const row500Sig = /`(EVT-[A-Z0-9]+)`/.exec(largeLines[row500Line - 1])?.[1] ?? 'Epsilon';

    expect(
      scrollToRenderedSearchMatchInRoot(
        largeBody,
        row500Sig,
        0,
        largeRaw.indexOf(row500Sig),
        largeRaw,
        false,
        { lineNumber: row500Line },
      ),
    ).toBe(true);
    expect(largeBody.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)?.closest('tr')).toBe(row500El);
    expect(row500El.classList.contains('is-collapsed-row')).toBe(false);
  });

  it('targets prose inside a callout or list containing a nested table without mis-mapping prose lines onto table rows', () => {
    const markdown = [
      '# Callout And List With Nested Tables',
      '',
      '> [!NOTE]',
      '> - Intro bullet mentions alpha before the table.',
      '> | Name | Value |',
      '> | --- | --- |',
      '> | Row1 | alpha |',
      '> | Row2 | beta |',
      '',
      '- Outer list item mentions gamma before nested table',
      '',
      '  | Key | Status |',
      '  | --- | --- |',
      '  | K1 | gamma |',
    ].join('\n');
    const body = renderIntoContainer(markdown);
    expect(body.querySelectorAll('table.mdn-table')).toHaveLength(2);

    // Line 4 is a bullet inside the callout before the nested table.
    expect(
      scrollToRenderedSearchMatchInRoot(body, 'alpha', 0, markdown.indexOf('alpha before'), markdown, false, { lineNumber: 4 }),
    ).toBe(true);
    const calloutProseMark = body.querySelector<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`);
    expect(calloutProseMark).not.toBeNull();
    expect(calloutProseMark?.closest('table')).toBeNull();
    expect(calloutProseMark?.closest('li')?.textContent).toContain('Intro bullet mentions alpha');

    // Line 7 is inside the nested table inside the callout.
    expect(
      scrollToRenderedSearchMatchInRoot(body, 'alpha', 1, markdown.indexOf('alpha |'), markdown, false, { lineNumber: 7 }),
    ).toBe(true);
    const calloutTableMark = body.querySelector<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`);
    expect(calloutTableMark).not.toBeNull();
    expect(calloutTableMark?.closest('td')?.textContent).toBe('alpha');
    expect(calloutTableMark?.closest('tr')?.textContent).toContain('Row1');

    // Line 10 is outer list prose before a nested table inside .mdn-list-nested.
    expect(
      scrollToRenderedSearchMatchInRoot(body, 'gamma', 0, markdown.indexOf('gamma before'), markdown, false, { lineNumber: 10 }),
    ).toBe(true);
    const listProseMark = body.querySelector<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`);
    expect(listProseMark?.closest('table')).toBeNull();
    expect(listProseMark?.closest('li')?.textContent).toContain('Outer list item mentions gamma');

    // Line 14 is inside the list's nested table.
    expect(
      scrollToRenderedSearchMatchInRoot(body, 'gamma', 1, markdown.indexOf('gamma |'), markdown, false, { lineNumber: 14 }),
    ).toBe(true);
    const listTableMark = body.querySelector<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`);
    expect(listTableMark?.closest('td')?.textContent).toBe('gamma');
    expect(listTableMark?.closest('tr')?.textContent).toContain('K1');
  });
});
