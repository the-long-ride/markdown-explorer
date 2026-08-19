import type { ExportBatchMode } from '../exportModel';
import type { ExportDocumentSnapshot } from '../exportSnapshot';
import type { ExportThemeSnapshot } from '../exportTheme';
import { preparePdfFonts } from './pdfFonts';
import { htmlToPdfNodes } from './pdfSemantic';
import type {
  PdfArtifact,
  PdfDocumentDefinition,
  PdfMakeLoader,
  PdfNode,
  PdfVisualBlock,
} from './pdfModel';

function safeBaseName(value: string): string {
  const cleaned = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, ' ').replace(/[. ]+$/g, '');
  return cleaned || 'export';
}

function bytes(value: Uint8Array | ArrayBuffer | ArrayBufferView): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function color(theme: ExportThemeSnapshot, name: string, fallback: string): string {
  const value = theme.cssVariables[name]?.trim();
  return value && !value.startsWith('var(') ? value : fallback;
}

function resolveNode(node: PdfNode, visuals: ReadonlyMap<string, PdfVisualBlock>): PdfNode {
  if (node._visualRef) {
    const visual = visuals.get(node._visualRef);
    if (!visual) return { text: 'Visual block unavailable', italics: true, color: '#777777', margin: node.margin };
    if (visual.svg) return { svg: visual.svg, fit: [500, 360], margin: node.margin };
    if (visual.image) return { image: visual.image, fit: [500, 360], margin: node.margin };
    return { text: visual.fallbackText || 'Visual block unavailable', italics: true, color: '#777777', margin: node.margin };
  }
  if (node.stack) return { ...node, stack: node.stack.map((child) => resolveNode(child, visuals)) };
  if (node.ul) return { ...node, ul: node.ul.map((child) => resolveNode(child, visuals)) };
  if (node.ol) return { ...node, ol: node.ol.map((child) => resolveNode(child, visuals)) };
  if (node.table) return {
    ...node,
    table: { ...node.table, body: node.table.body.map((row) => row.map((cell) => resolveNode(cell, visuals))) },
  };
  return node;
}

function definitionFor(
  documents: readonly ExportDocumentSnapshot[],
  theme: ExportThemeSnapshot,
  defaultFont: string,
  title: string,
): PdfDocumentDefinition {
  const content: PdfNode[] = [];
  documents.forEach((document, index) => {
    if (index > 0) content.push({ text: '', pageBreak: 'before' });
    const visuals = new Map(document.visualBlocks.map((block) => [block.id, block]));
    content.push(...htmlToPdfNodes(document.html).map((node) => resolveNode(node, visuals)));
  });
  return {
    content,
    pageMargins: [42, 46, 42, 50],
    defaultStyle: { font: defaultFont, fontSize: 10.5, color: color(theme, '--tx', '#202124') },
    styles: {
      h1: { fontSize: 24, bold: true, color: color(theme, '--tx', '#202124') },
      h2: { fontSize: 20, bold: true, color: color(theme, '--tx', '#202124') },
      h3: { fontSize: 16, bold: true, color: color(theme, '--tx', '#202124') },
      h4: { fontSize: 14, bold: true }, h5: { fontSize: 12, bold: true }, h6: { fontSize: 11, bold: true },
      quote: { italics: true, color: color(theme, '--tx-m', '#5f6368') },
      code: { font: 'Roboto', fontSize: 8.5, color: color(theme, '--tx', '#202124'), fillColor: color(theme, '--bg-e', '#f5f5f5') },
    },
    info: { title, creator: 'Markdown Explorer' },
  };
}

async function renderDefinition(
  definition: PdfDocumentDefinition,
  loader: PdfMakeLoader,
  theme: ExportThemeSnapshot,
): Promise<{ bytes: Uint8Array; warnings: string[] }> {
  const runtime = await loader();
  runtime.pdfMake.addVirtualFileSystem(runtime.defaultVfs);
  const fonts = preparePdfFonts(theme);
  if (Object.keys(fonts.vfs).length) runtime.pdfMake.addVirtualFileSystem(fonts.vfs);
  if (Object.keys(fonts.fonts).length) runtime.pdfMake.addFonts?.(fonts.fonts);
  const buffer = await runtime.pdfMake.createPdf(definition).getBuffer();
  return { bytes: bytes(buffer), warnings: [...fonts.warnings] };
}

export async function composePdfArtifacts(args: {
  documents: readonly ExportDocumentSnapshot[];
  batchMode: ExportBatchMode;
  title: string;
  baseName: string;
  theme: ExportThemeSnapshot;
  loadPdfMake: PdfMakeLoader;
}): Promise<PdfArtifact[]> {
  if (args.documents.length === 0) throw new Error('PDF export has no documents');
  const fonts = preparePdfFonts(args.theme);
  const visualWarnings = (document: ExportDocumentSnapshot) => document.visualBlocks.flatMap((block) => block.warning ? [block.warning] : []);

  if (args.batchMode === 'merged') {
    const definition = definitionFor(args.documents, args.theme, fonts.defaultFont, args.title);
    const rendered = await renderDefinition(definition, args.loadPdfMake, args.theme);
    return [{ fileName: `${safeBaseName(args.baseName)}-merged.pdf`, bytes: rendered.bytes, warnings: [...rendered.warnings, ...args.documents.flatMap(visualWarnings)] }];
  }

  const artifacts: PdfArtifact[] = [];
  for (const document of args.documents) {
    const definition = definitionFor([document], args.theme, fonts.defaultFont, document.file.title);
    const rendered = await renderDefinition(definition, args.loadPdfMake, args.theme);
    artifacts.push({
      fileName: `${safeBaseName(document.file.title || document.file.fileName.replace(/\.mdx?$/i, ''))}.pdf`,
      bytes: rendered.bytes,
      warnings: [...rendered.warnings, ...visualWarnings(document)],
    });
  }
  return artifacts;
}
