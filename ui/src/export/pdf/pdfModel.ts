export type PdfVisualKind = 'image' | 'htmlPreview' | 'mermaid' | 'chart';

export interface PdfVisualBlock {
  id: string;
  kind: PdfVisualKind;
  image?: string;
  svg?: string;
  fallbackText?: string;
  width?: number;
  height?: number;
  warning?: string;
}

export interface PdfTextRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
  font?: string;
  fontSize?: number;
  color?: string;
  link?: string;
  decoration?: 'underline';
}

export interface PdfNode {
  text?: string | readonly PdfTextRun[];
  stack?: readonly PdfNode[];
  ul?: readonly PdfNode[];
  ol?: readonly PdfNode[];
  table?: {
    headerRows?: number;
    widths?: readonly (string | number)[];
    body: readonly (readonly PdfNode[])[];
  };
  image?: string;
  svg?: string;
  fit?: readonly [number, number];
  width?: number;
  height?: number;
  style?: string;
  margin?: readonly [number, number, number, number];
  pageBreak?: 'before' | 'after';
  color?: string;
  fillColor?: string;
  italics?: boolean;
  bold?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  _visualRef?: string;
}

export interface PdfDocumentDefinition {
  content: readonly PdfNode[];
  defaultStyle?: { font?: string; fontSize?: number; color?: string };
  styles?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  pageMargins?: readonly [number, number, number, number];
  info?: { title?: string; subject?: string; creator?: string };
}

export interface PdfArtifact {
  fileName: string;
  bytes: Uint8Array;
  warnings: readonly string[];
}

export interface PdfMakeDocument {
  getBuffer(): Promise<Uint8Array | ArrayBuffer | ArrayBufferView>;
}

export interface PdfMakeApi {
  addVirtualFileSystem(vfs: unknown): void;
  addFonts?(fonts: Readonly<Record<string, unknown>>): void;
  createPdf(definition: PdfDocumentDefinition): PdfMakeDocument;
}

export interface PdfMakeRuntime {
  pdfMake: PdfMakeApi;
  defaultVfs: unknown;
}

export type PdfMakeLoader = () => Promise<PdfMakeRuntime>;
