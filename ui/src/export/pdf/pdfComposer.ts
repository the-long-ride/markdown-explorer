import type { ExportBatchMode } from '../exportModel';
import type { ExportDocumentSnapshot } from '../exportSnapshot';
import type { ExportThemeSnapshot } from '../exportTheme';
import { preparePdfFonts } from './pdfFonts';
import { layoutPdfVisual, type PdfPrintPalette } from './pdfPrintLayout';
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

function resolveRuns(node: PdfNode, palette: PdfPrintPalette): PdfNode {
  if (!Array.isArray(node.text)) return node;
  return {
    ...node,
    text: node.text.map((run) => run.link ? { ...run, color: palette.link } : run),
  };
}

// Classic word-processor conventions: near-black ink on white paper, blue
// underlined hyperlinks, gray panels for code — independent of app themes.
const STANDARD_PDF_PALETTE: PdfPrintPalette = {
  page: '#ffffff',
  text: '#000000',
  muted: '#595959',
  panel: '#f2f2f2',
  border: '#bfbfbf',
  accent: '#000000',
  link: '#0563c1',
};

// A4 with 1-inch margins and a conventional heading scale (Word/pandoc-like).
const STANDARD_PAGE_SIZE: NonNullable<PdfDocumentDefinition['pageSize']> = 'A4';
const STANDARD_PAGE_MARGINS: [number, number, number, number] = [72, 72, 72, 72];

function resolveNode(node: PdfNode, visuals: ReadonlyMap<string, PdfVisualBlock>, palette: PdfPrintPalette): PdfNode {
  if (node._visualRef) {
    const visual = visuals.get(node._visualRef);
    if (!visual) return { text: 'Visual block unavailable', italics: true, color: palette.muted, margin: node.margin };
    const visualLayout = layoutPdfVisual(visual);
    const visualNode = {
      fit: visualLayout.fit,
      margin: node.margin,
      alignment: 'center' as const,
      pageOrientation: visualLayout.orientation,
    };
    if (visual.svg) return { ...visualNode, svg: visual.svg };
    if (visual.image) return { ...visualNode, image: visual.image };
    return { text: visual.fallbackText || 'Visual block unavailable', italics: true, color: palette.muted, margin: node.margin };
  }
  if (node.stack) return resolveRuns({ ...node, stack: node.stack.map((child) => resolveNode(child, visuals, palette)) }, palette);
  if (node.ul) return resolveRuns({ ...node, ul: node.ul.map((child) => resolveNode(child, visuals, palette)) }, palette);
  if (node.ol) return resolveRuns({ ...node, ol: node.ol.map((child) => resolveNode(child, visuals, palette)) }, palette);
  if (node.table) return resolveRuns({
    ...node,
    table: { ...node.table, body: node.table.body.map((row) => row.map((cell) => resolveNode(cell, visuals, palette))) },
  }, palette);
  return resolveRuns(node, palette);
}

function definitionFor(
  documents: readonly ExportDocumentSnapshot[],
  theme: ExportThemeSnapshot,
  defaultFont: string,
  title: string,
): PdfDocumentDefinition {
  void theme; // PDF follows standard document styling, not app themes.
  const palette = STANDARD_PDF_PALETTE;
  const content: PdfNode[] = [];
  documents.forEach((document, index) => {
    if (index > 0) content.push({ text: '', pageBreak: 'before' });
    const visuals = new Map(document.visualBlocks.map((block) => [block.id, block]));
    content.push(...htmlToPdfNodes(document.html).map((node) => resolveNode(node, visuals, palette)));
  });
  return {
    content,
    pageSize: STANDARD_PAGE_SIZE,
    pageMargins: STANDARD_PAGE_MARGINS,
    defaultStyle: { font: defaultFont, fontSize: 11, lineHeight: 1.35, color: palette.text },
    styles: {
      h1: { fontSize: 20, bold: true, color: palette.text, margin: [0, 0, 6, 8] },
      h2: { fontSize: 16, bold: true, color: palette.text, margin: [0, 0, 4, 6] },
      h3: { fontSize: 13, bold: true, color: palette.text, margin: [0, 0, 4, 5] },
      h4: { fontSize: 11.5, bold: true, color: palette.text, margin: [0, 0, 3, 4] },
      h5: { fontSize: 11, bold: true, color: palette.text },
      h6: { fontSize: 11, bold: true, italics: true, color: palette.muted },
      quote: { italics: true, color: palette.muted },
      code: { font: 'Roboto', fontSize: 9, color: palette.text, fillColor: palette.panel },
    },
    footer: (currentPage, pageCount) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: 'center',
      color: palette.muted,
      fontSize: 9,
      margin: [0, 14, 0, 0],
    }),
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
