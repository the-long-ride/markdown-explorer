import { renderMarkdown } from './markdown-renderer';
import { virtualFiles, virtualTree, getVirtualContent } from './virtual-workspace';
import type { MdFile, FolderNode } from '../../ui/src/types';
import { isExtraDocumentFile, convertWebDocumentToMarkdown } from './web-document-converter';

interface TestState {
  flatList: MdFile[];
  workspaceTree: FolderNode | null;
  currentFile: string | null;
}

interface TestHandlerDeps {
  send: (message: unknown) => void;
  state: TestState;
  hostInfo: () => Record<string, unknown>;
  findFileInfo: (list: MdFile[], relativePath: string) => { relativePath: string; title: string };
  getDocumentConversionEnabled?: () => boolean;
}

export function createTestModeHandlers({
  send,
  state,
  hostInfo,
  findFileInfo,
  getDocumentConversionEnabled,
}: TestHandlerDeps) {
  const isDocConv = () => Boolean(getDocumentConversionEnabled?.());

  async function sendTestContent(relativePath: string) {
    const raw = getVirtualContent(relativePath);
    if (raw === null) {
      send({
        command: 'renderContent',
        html: `<p>File not found: <code>${relativePath}</code></p>`,
        markdownSource: '',
        frontmatter: {},
        toc: [],
        filePath: relativePath,
        relativePath,
        title: relativePath,
        fileList: state.flatList,
        previewInfo: null,
        documentConversionEnabled: isDocConv(),
      });
      return;
    }

    let markdownSource = raw;
    let previewInfo: any = null;
    let documentWrite: any = {
      supported: true,
      revision: String(raw.length),
    };

    if (isExtraDocumentFile(relativePath)) {
      const converted = await convertWebDocumentToMarkdown({ name: relativePath, text: raw });
      markdownSource = converted.markdown;
      previewInfo = converted.previewInfo;
      if (converted.previewInfo?.readOnly) {
        documentWrite = { supported: false, revision: null, reason: 'read-only-runtime' };
      }
    }

    const { html, frontmatter, toc } = renderMarkdown(relativePath, markdownSource);
    const fileInfo = findFileInfo(state.flatList, relativePath);

    send({
      command: 'renderContent',
      html,
      markdownSource,
      sourceDocumentText: /\.html?$/i.test(relativePath) ? raw : null,
      frontmatter,
      toc,
      filePath: relativePath,
      relativePath: fileInfo.relativePath,
      title: fileInfo.title,
      fileList: state.flatList,
      previewInfo,
      documentWrite,
      documentConversionEnabled: isDocConv(),
    });
  }

  async function refreshTestWorkspace() {
    state.flatList = virtualFiles;
    state.workspaceTree = virtualTree;
    send({ command: 'workspaceFilesChanged', fileList: state.flatList, tree: state.workspaceTree,
      workspaceName: 'Test Workspace', workspacePath: 'test-workspace', documentConversionEnabled: isDocConv() });
  }

  async function sendTestReady() {
    state.flatList = virtualFiles;
    state.workspaceTree = virtualTree;
    state.currentFile = virtualFiles.some(file => file.relativePath === state.currentFile)
      ? state.currentFile : virtualFiles[0]?.relativePath ?? null;

    send({
      command: 'readyAck',
      fileList: state.flatList,
      tree: state.workspaceTree,
      theme: 'dark',
      themeStyle: 'default',
      defaultExpanded: true,
      workspaceName: 'Test Workspace',
      workspacePath: 'test-workspace',
      recentWorkspaces: [],
      documentConversionEnabled: isDocConv(),
      ...hostInfo(),
    });

    if (state.currentFile) {
      await sendTestContent(state.currentFile);
    }
  }

  return { sendTestReady, sendTestContent, refreshTestWorkspace };
}

