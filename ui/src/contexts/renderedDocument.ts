import type { AppSettings, Frontmatter, RenderContentMessage, TocEntry } from '../types';
import { renderMarkdownClientSide } from './contentTabState';

export interface RenderedDocument {
  html: string;
  frontmatter: Frontmatter;
  toc: TocEntry[];
}

export type RenderPreviewSettings = Pick<
  AppSettings,
  'defaultHtmlPreview' | 'defaultHtmlCodeBlockPreview' | 'defaultCsvPreview'
>;

export function resolveRenderedDocument(
  msg: RenderContentMessage,
  settings: RenderPreviewSettings,
): RenderedDocument {
  if (!msg.markdownSource) {
    return {
      html: msg.html,
      frontmatter: msg.frontmatter,
      toc: msg.toc,
    };
  }

  const filePath = msg.filePath || null;
  return renderMarkdownClientSide(
    msg.markdownSource,
    filePath,
    Boolean(filePath?.endsWith('.mdx')),
    settings,
  );
}
