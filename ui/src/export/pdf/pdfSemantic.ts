import type { PdfNode, PdfTextRun } from './pdfModel';

const SKIP_SELECTOR = '.mdn-copy-btn,.mdn-section-copy-btn,.mdn-section-chevron,.mdn-table-toolbar,.mdn-table-controls,.mdn-table-filter-btn,.mdn-table-columns-toggle,.mdn-table-view-dropdown,.tooltip-text';

function textRun(text: string, element?: Element): PdfTextRun | null {
  if (!text) return null;
  const run: PdfTextRun = { text };
  if (!element) return run;
  const tag = element.tagName.toLowerCase();
  if (tag === 'strong' || tag === 'b') run.bold = true;
  if (tag === 'em' || tag === 'i') run.italics = true;
  if (tag === 'code') { run.font = 'Roboto'; run.fontSize = 9; }
  if (tag === 'a') {
    const href = element.getAttribute('href');
    if (href) { run.link = href; run.decoration = 'underline'; }
  }
  return run;
}

function inlineRuns(node: Node, inherited?: Element): PdfTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    const run = textRun(text, inherited);
    return run ? [run] : [];
  }
  if (!(node instanceof Element) || node.matches(SKIP_SELECTOR)) return [];
  if (node.tagName.toLowerCase() === 'br') return [{ text: '\n' }];
  const owner = node;
  const runs = Array.from(node.childNodes).flatMap((child) => inlineRuns(child, owner));
  if (runs.length === 0 && node.textContent) {
    const run = textRun(node.textContent, owner);
    return run ? [run] : [];
  }
  return runs.map((run) => ({
    ...run,
    bold: run.bold || ['strong', 'b'].includes(owner.tagName.toLowerCase()) || undefined,
    italics: run.italics || ['em', 'i'].includes(owner.tagName.toLowerCase()) || undefined,
    font: run.font || (owner.tagName.toLowerCase() === 'code' ? 'Roboto' : undefined),
    fontSize: run.fontSize || (owner.tagName.toLowerCase() === 'code' ? 9 : undefined),
    link: run.link || (owner.tagName.toLowerCase() === 'a' ? owner.getAttribute('href') || undefined : undefined),
    decoration: run.decoration || (owner.tagName.toLowerCase() === 'a' ? 'underline' : undefined),
  }));
}

function cellNode(cell: Element): PdfNode {
  return { text: inlineRuns(cell), margin: [3, 3, 3, 3] };
}

function tableNode(table: HTMLTableElement): PdfNode {
  const rows = Array.from(table.rows).map((row) => Array.from(row.cells).map(cellNode));
  const width = Math.max(1, ...rows.map((row) => row.length));
  return { table: { headerRows: table.tHead ? 1 : 0, widths: Array.from({ length: width }, () => '*'), body: rows } };
}

function listNode(list: Element, ordered: boolean): PdfNode {
  const items = Array.from(list.children).filter((child) => child.tagName.toLowerCase() === 'li').map((item) => {
    const blocks = blockChildren(item);
    return blocks.length === 1 ? blocks[0] : { stack: blocks };
  });
  return ordered ? { ol: items, margin: [0, 3, 0, 6] } : { ul: items, margin: [0, 3, 0, 6] };
}

function blockNode(element: Element): PdfNode[] {
  if (element.matches(SKIP_SELECTOR) || element.getAttribute('aria-hidden') === 'true') return [];
  const visualRef = element.getAttribute('data-mdn-pdf-visual-id');
  if (visualRef) return [{ _visualRef: visualRef, margin: [0, 8, 0, 10] }];
  const tag = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return [{ text: inlineRuns(element), style: tag, margin: [0, 10, 0, 5] }];
  if (tag === 'p') return [{ text: inlineRuns(element), margin: [0, 2, 0, 6] }];
  if (tag === 'blockquote') return [{ stack: blockChildren(element), style: 'quote', margin: [14, 5, 0, 8] }];
  if (tag === 'pre') return [{ text: element.textContent || '', style: 'code', margin: [0, 5, 0, 8] }];
  if (tag === 'ul' || tag === 'ol') return [listNode(element, tag === 'ol')];
  if (tag === 'table') return [tableNode(element as HTMLTableElement)];
  if (tag === 'hr') return [{ text: '────────────────────────────────────────', color: '#999999', margin: [0, 6, 0, 6] }];
  if (tag === 'img') return [{ text: element.getAttribute('alt') || 'Image', italics: true }];
  const children = blockChildren(element);
  if (children.length) return children;
  const runs = inlineRuns(element);
  return runs.some((run) => run.text.trim()) ? [{ text: runs }] : [];
}

function blockChildren(element: Element): PdfNode[] {
  const nodes: PdfNode[] = [];
  for (const child of Array.from(element.children)) nodes.push(...blockNode(child));
  if (nodes.length === 0) {
    const runs = inlineRuns(element);
    if (runs.some((run) => run.text.trim())) nodes.push({ text: runs });
  }
  return nodes;
}

export function htmlToPdfNodes(html: string): PdfNode[] {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return Array.from(parsed.body.children).flatMap(blockNode);
}
