export const EXTRA_DOCUMENT_EXTENSIONS = [
  '.txt', '.html', '.htm', '.csv', '.tsv',
  '.doc', '.docx', '.pdf', '.xls', '.xlsx',
  '.xlm', '.pptx', '.odt', '.odp', '.ods', '.rtf',
] as const;

export type ExtraDocumentExtension = typeof EXTRA_DOCUMENT_EXTENSIONS[number];

export function isExtraDocumentFile(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1) return false;
  const ext = fileName.slice(dot).toLowerCase();
  return (EXTRA_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext);
}

export function isSupportedWebDocumentFile(fileName: string, documentConversionEnabled: boolean): boolean {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1) return false;
  const ext = fileName.slice(dot).toLowerCase();
  if (ext === '.md' || ext === '.mdx' || ext === '.markdown') return true;
  return Boolean(documentConversionEnabled) && isExtraDocumentFile(fileName);
}

export interface WebDocumentPreviewInfo {
  convertedFrom: string;
  readOnly: boolean;
  kind?: 'converted' | 'text';
  sourceExtension?: string;
  sourceLabel?: string;
}

export interface WebConversionResult {
  markdown: string;
  previewInfo: WebDocumentPreviewInfo | null;
}

async function extractZip(buffer: ArrayBuffer): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  for (let i = 0; i <= bytes.length - 30; i++) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04) {
      const method = view.getUint16(i + 8, true);
      let compSize = view.getUint32(i + 18, true);
      const nameLen = view.getUint16(i + 26, true);
      const extraLen = view.getUint16(i + 28, true);
      if (i + 30 + nameLen > bytes.length) continue;
      const name = new TextDecoder().decode(bytes.subarray(i + 30, i + 30 + nameLen));
      const dataOffset = i + 30 + nameLen + extraLen;
      if (dataOffset > bytes.length) continue;
      if (compSize === 0 || dataOffset + compSize > bytes.length) {
        let next = bytes.length;
        for (let j = dataOffset; j <= bytes.length - 4; j++) {
          if (bytes[j] === 0x50 && bytes[j + 1] === 0x4b) { next = j; break; }
        }
        compSize = next - dataOffset;
      }
      const slice = bytes.subarray(dataOffset, dataOffset + compSize);
      try {
        if (method === 0) {
          map.set(name, new TextDecoder().decode(slice));
        } else if (method === 8 && typeof DecompressionStream !== 'undefined') {
          const ds = new DecompressionStream('deflate-raw');
          const stream = new Response(slice as any).body?.pipeThrough(ds);
          if (stream) map.set(name, await new Response(stream).text());
        }
      } catch {}
    }
  }
  return map;
}

function stripXml(xml: string): string {
  return xml.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

function parseDocx(entries: Map<string, string>): string {
  const doc = entries.get('word/document.xml') || '';
  const paragraphs: string[] = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(doc)) !== null) {
    const pContent = pMatch[1];
    const text = (pContent.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [])
      .map(t => stripXml(t)).join('');
    if (!text.trim()) continue;
    const styleMatch = /<w:pStyle\s+w:val="Heading(\d)"/i.exec(pContent);
    const prefix = styleMatch ? '#'.repeat(Number(styleMatch[1])) + ' ' : '';
    paragraphs.push(prefix + text.trim());
  }
  return paragraphs.join('\n\n');
}

function parsePptx(entries: Map<string, string>): string {
  const slides: string[] = [];
  const keys = [...entries.keys()].filter(k => /^ppt\/slides\/slide\d+\.xml$/i.test(k)).sort();
  for (let idx = 0; idx < keys.length; idx++) {
    const xml = entries.get(keys[idx]) || '';
    const texts = (xml.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g) || []).map(t => stripXml(t).trim()).filter(Boolean);
    if (texts.length) {
      slides.push(`## Slide ${idx + 1}\n\n` + texts.map(t => `* ${t}`).join('\n'));
    }
  }
  return slides.join('\n\n');
}

function parseXlsx(entries: Map<string, string>): string {
  const stringsXml = entries.get('xl/sharedStrings.xml') || '';
  const shared: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(stringsXml)) !== null) {
    shared.push((siMatch[1].match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => stripXml(t)).join(''));
  }
  const sheetXml = entries.get('xl/worksheets/sheet1.xml') || [...entries.entries()].find(([k]) => k.startsWith('xl/worksheets/sheet'))?.[1] || '';
  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const isString = /t="s"/i.test(cellMatch[1]);
      const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(cellMatch[2]);
      const val = vMatch ? (isString ? shared[Number(vMatch[1])] || '' : vMatch[1]) : '';
      cells.push(val.replace(/\|/g, '\\|').trim());
    }
    if (cells.some(c => c.length > 0)) rows.push(cells);
  }
  if (!rows.length) return '';
  const maxCols = Math.max(...rows.map(r => r.length));
  const pad = (r: string[]) => r.concat(Array(maxCols - r.length).fill(''));
  const header = pad(rows[0]);
  const sep = Array(maxCols).fill('---');
  const body = rows.slice(1).map(pad);
  return [`| ${header.join(' | ')} |`, `| ${sep.join(' | ')} |`, ...body.map(r => `| ${r.join(' | ')} |`)].join('\n');
}

function parseOdf(entries: Map<string, string>): string {
  const xml = entries.get('content.xml') || '';
  const lines: string[] = [];
  const regex = /<text:(h|p)\b[^>]*>([\s\S]*?)<\/text:(h|p)>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const text = stripXml(match[2]).trim();
    if (!text) continue;
    lines.push(match[1] === 'h' ? `# ${text}` : text);
  }
  return lines.join('\n\n');
}

function parseHtml(html: string): string {
  const stripped = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(stripped, 'text/html');
      const nodes = doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, pre');
      if (nodes.length) {
        return Array.from(nodes).map(n => {
          const tag = n.tagName.toLowerCase();
          const text = n.textContent?.trim() || '';
          if (!text) return '';
          if (tag.startsWith('h')) return `${'#'.repeat(Number(tag[1]))} ${text}`;
          if (tag === 'li') return `* ${text}`;
          if (tag === 'pre') return `\`\`\`\n${text}\n\`\`\``;
          return text;
        }).filter(Boolean).join('\n\n');
      }
    } catch {}
  }
  return stripXml(stripped).split(/\n+/).map(l => l.trim()).filter(Boolean).join('\n\n');
}

function parseRtf(rtf: string): string {
  return rtf
    .replace(/\\par\b/gi, '\n\n')
    .replace(/\\tab\b/gi, '\t')
    .replace(/\\'[0-9a-fA-F]{2}/g, m => String.fromCharCode(parseInt(m.slice(2), 16)))
    .replace(/\\[a-zA-Z]+(-?\d+)?[ ]?/g, '')
    .replace(/[{}]/g, '')
    .split(/\n{3,}/).map(p => p.trim()).filter(Boolean).join('\n\n');
}

function extractBinaryStrings(bytes: Uint8Array): string {
  const strings: string[] = [];
  let current: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
      current.push(b);
    } else {
      if (current.length >= 4) {
        const str = String.fromCharCode(...current).trim();
        if (str.length >= 4 && !/^[0-9a-f]{8,}$/i.test(str)) strings.push(str);
      }
      current = [];
    }
  }
  return strings.join('\n\n');
}

export async function convertWebDocumentToMarkdown(
  file: File | { name: string; text?: string | (() => Promise<string>); arrayBuffer?: () => Promise<ArrayBuffer> },
): Promise<WebConversionResult> {
  const name = file.name || '';
  const dot = name.lastIndexOf('.');
  const ext = dot !== -1 ? name.slice(dot).toLowerCase() : '';
  const label = ext ? ext.slice(1).toUpperCase() : 'DOCUMENT';

  const getText = async () => {
    if (typeof file.text === 'function') return await file.text();
    if (typeof file.text === 'string') return file.text;
    if (typeof file.arrayBuffer === 'function') {
      return new TextDecoder().decode(await file.arrayBuffer());
    }
    return '';
  };

  const getBuffer = async () => {
    if (typeof file.arrayBuffer === 'function') return await file.arrayBuffer();
    return new TextEncoder().encode(await getText()).buffer as ArrayBuffer;
  };

  if (ext === '.md' || ext === '.mdx' || ext === '.markdown' || !ext) {
    return { markdown: await getText(), previewInfo: null };
  }

  if (ext === '.txt') {
    return {
      markdown: await getText(),
      previewInfo: { convertedFrom: 'TXT', readOnly: false, kind: 'text', sourceExtension: '.txt', sourceLabel: 'TXT' },
    };
  }

  if (ext === '.csv' || ext === '.tsv') {
    const raw = (await getText()).trim();
    const lang = ext === '.csv' ? 'csv' : 'tsv';
    return {
      markdown: `\`\`\`${lang}\n${raw}\n\`\`\``,
      previewInfo: { convertedFrom: label, readOnly: true, kind: 'converted', sourceExtension: ext, sourceLabel: label },
    };
  }

  if (ext === '.html' || ext === '.htm') {
    const raw = await getText();
    return {
      markdown: parseHtml(raw),
      previewInfo: { convertedFrom: 'HTML', readOnly: true, kind: 'converted', sourceExtension: ext, sourceLabel: 'HTML' },
    };
  }

  if (ext === '.rtf') {
    const raw = await getText();
    return {
      markdown: parseRtf(raw),
      previewInfo: { convertedFrom: 'RTF', readOnly: true, kind: 'converted', sourceExtension: '.rtf', sourceLabel: 'RTF' },
    };
  }

  if (['.docx', '.pptx', '.xlsx', '.odt', '.odp', '.ods'].includes(ext)) {
    const buf = await getBuffer();
    const entries = await extractZip(buf);
    let md = '';
    if (ext === '.docx') md = parseDocx(entries);
    else if (ext === '.pptx') md = parsePptx(entries);
    else if (ext === '.xlsx') md = parseXlsx(entries);
    else md = parseOdf(entries);
    if (!md.trim()) md = extractBinaryStrings(new Uint8Array(buf));
    return {
      markdown: md.trim() || `# ${name}\n\n_No readable text content extracted._`,
      previewInfo: { convertedFrom: label, readOnly: true, kind: 'converted', sourceExtension: ext, sourceLabel: label },
    };
  }

  const buf = await getBuffer();
  const md = extractBinaryStrings(new Uint8Array(buf));
  return {
    markdown: md.trim() || `# ${name}\n\n_No readable text content extracted._`,
    previewInfo: { convertedFrom: label, readOnly: true, kind: 'converted', sourceExtension: ext, sourceLabel: label },
  };
}
