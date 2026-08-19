import type { PdfMakeRuntime } from './pdfModel';

export async function loadPdfMakeRuntime(): Promise<PdfMakeRuntime> {
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    // @ts-expect-error pdfmake build artifacts do not publish TypeScript declarations.
    import('pdfmake/build/pdfmake'),
    // @ts-expect-error pdfmake build artifacts do not publish TypeScript declarations.
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const defaultVfs = pdfFontsModule.default ?? pdfFontsModule;
  if (!pdfMake?.createPdf || !pdfMake?.addVirtualFileSystem) {
    throw new Error('PDF runtime could not be initialized.');
  }
  return { pdfMake, defaultVfs } as PdfMakeRuntime;
}
