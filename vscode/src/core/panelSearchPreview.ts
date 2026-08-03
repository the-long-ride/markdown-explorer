import fs from 'fs';
import { isMarkdownFilePath, isTextDocumentFilePath } from './documentConversion';
import { normalizePanelPath } from './panelNavigation';
import type { MdFile, SearchPreviewResultMessage } from '../types';

interface SearchPreviewRequest {
  readonly requestId: string;
  readonly filePath: string;
}

export async function loadPanelSearchPreview(
  request: SearchPreviewRequest,
  files: readonly MdFile[],
): Promise<SearchPreviewResultMessage> {
  const filePath = String(request.filePath || '');
  const item = files.find(
    (candidate) => normalizePanelPath(candidate.fsPath) === normalizePanelPath(filePath),
  );
  if (!item || (!isMarkdownFilePath(item.fsPath) && !isTextDocumentFilePath(item.fsPath))) {
    return {
      command: 'searchPreviewResult', requestId: request.requestId, ok: false,
      filePath, reason: 'outside-workspace',
    };
  }
  try {
    return {
      command: 'searchPreviewResult', requestId: request.requestId, ok: true,
      filePath: item.fsPath, markdownSource: await fs.promises.readFile(item.fsPath, 'utf8'),
    };
  } catch {
    return {
      command: 'searchPreviewResult', requestId: request.requestId, ok: false,
      filePath: item.fsPath, reason: 'missing',
    };
  }
}
