import type { DocumentPreviewInfo, MdFile, RenderContentMessage } from '../types';

export function createWelcomeRenderContentMessage(fileList: MdFile[]): RenderContentMessage {
  return {
    command: 'renderContent',
    html: '',
    markdownSource: '',
    frontmatter: {},
    toc: [],
    filePath: '',
    relativePath: 'Welcome Page',
    title: 'Welcome',
    fileList,
    previewInfo: null,
  };
}

export function createRenderContentMessage(params: {
  html: string;
  markdownSource: string;
  sourceDocumentText: string | null;
  frontmatter: Record<string, unknown>;
  toc: readonly unknown[];
  filePath: string;
  relativePath: string;
  title: string;
  fileList: MdFile[];
  previewInfo: DocumentPreviewInfo | null;
  documentWrite: unknown;
}): RenderContentMessage {
  return {
    command: 'renderContent',
    html: params.html,
    markdownSource: params.markdownSource,
    sourceDocumentText: params.sourceDocumentText,
    frontmatter: params.frontmatter,
    toc: params.toc as any,
    filePath: params.filePath,
    relativePath: params.relativePath,
    title: params.title,
    fileList: params.fileList,
    previewInfo: params.previewInfo,
    ...({ documentWrite: params.documentWrite } as any),
  };
}
