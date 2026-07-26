/**
 * Convert an HTML document into Markdown in the browser UI.
 *
 * Full HTML documents use this shared converter instead of host-specific
 * document-conversion sidecars, so Tauri, Electron, VS Code, Chromium, and
 * the web file picker all render the same Markdown view from the original
 * source text.
 */
export function convertHtmlSourceToMarkdown(htmlSource: string): string {
  if (!htmlSource.trim()) return '';
  const documentNode = new DOMParser().parseFromString(htmlSource, 'text/html');

  const cleanText = (value: string) => value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ');

  const escapeInline = (value: string) => value
    .replace(/\\/g, '\\\\')
    .replace(/([*_`])/g, '\\$1');

  const renderChildren = (node: Node, context: { listDepth: number; inPre?: boolean } = { listDepth: 0 }) =>
    Array.from(node.childNodes).map((child) => renderNode(child, context)).join('');

  const renderTable = (table: HTMLTableElement): string => {
    const rows = Array.from(table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr'));
    if (!rows.length) return '';
    const cells = rows.map((row) => Array.from(row.children)
      .filter((cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement)
      .map((cell) => cleanText(cell.textContent || '').trim().replace(/\|/g, '\\|')));
    const width = Math.max(...cells.map((row) => row.length));
    if (!width) return '';
    const normalized = cells.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
    const header = normalized[0];
    const body = normalized.slice(1);
    return `\n\n| ${header.join(' | ')} |\n| ${header.map(() => '---').join(' | ')} |${body.length ? `\n${body.map((row) => `| ${row.join(' | ')} |`).join('\n')}` : ''}\n\n`;
  };

  const renderNode = (node: Node, context: { listDepth: number; inPre?: boolean }): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent || '';
      return context.inPre ? value : escapeInline(cleanText(value));
    }
    if (!(node instanceof HTMLElement)) return '';

    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'template', 'head', 'meta', 'link', 'base', 'title'].includes(tag)) return '';

    const children = () => renderChildren(node, context);
    switch (tag) {
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const level = Number(tag.slice(1));
        return `\n\n${'#'.repeat(level)} ${children().trim()}\n\n`;
      }
      case 'p':
      case 'section':
      case 'article':
      case 'header':
      case 'footer':
      case 'main':
      case 'aside':
      case 'div':
        return `\n\n${children().trim()}\n\n`;
      case 'br':
        return '  \n';
      case 'hr':
        return '\n\n---\n\n';
      case 'strong':
      case 'b':
        return `**${children().trim()}**`;
      case 'em':
      case 'i':
        return `*${children().trim()}*`;
      case 'del':
      case 's':
      case 'strike':
        return `~~${children().trim()}~~`;
      case 'code': {
        if (node.parentElement?.tagName.toLowerCase() === 'pre') return node.textContent || '';
        return `\`${(node.textContent || '').replace(/`/g, '\\`')}\``;
      }
      case 'pre': {
        const code = node.querySelector(':scope > code');
        const className = code?.className || '';
        const language = /(?:language-|lang-)([\w-]+)/.exec(className)?.[1] || '';
        const value = (code?.textContent || node.textContent || '').replace(/\n+$/, '');
        return `\n\n\`\`\`${language}\n${value}\n\`\`\`\n\n`;
      }
      case 'a': {
        const label = children().trim() || node.getAttribute('href') || '';
        const href = node.getAttribute('href');
        return href ? `[${label}](${href})` : label;
      }
      case 'img': {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        const title = node.getAttribute('title');
        return src ? `![${alt}](${src}${title ? ` \"${title.replace(/\"/g, '\\\"')}\"` : ''})` : '';
      }
      case 'blockquote': {
        const content = children().trim().split('\n').map((line) => `> ${line}`).join('\n');
        return `\n\n${content}\n\n`;
      }
      case 'ul':
      case 'ol': {
        const ordered = tag === 'ol';
        const items = Array.from(node.children).filter((child) => child.tagName.toLowerCase() === 'li');
        const rendered = items.map((item, index) => {
          const marker = ordered ? `${index + 1}.` : '-';
          const content = renderChildren(item, { ...context, listDepth: context.listDepth + 1 }).trim();
          const indent = '  '.repeat(context.listDepth);
          return `${indent}${marker} ${content.replace(/\n/g, `\n${indent}  `)}`;
        }).join('\n');
        return `\n${rendered}\n`;
      }
      case 'li':
        return children();
      case 'table':
        return renderTable(node as HTMLTableElement);
      case 'iframe':
      case 'object':
      case 'embed':
        return '';
      default:
        return children();
    }
  };

  return renderChildren(documentNode.body)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
