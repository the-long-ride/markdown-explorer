import { renderMarkdown } from '../../chromium-xtension/src/markdown-renderer';
import { virtualFiles, virtualTree, getVirtualContent } from './virtual-workspace';
import type { MdFile, FolderNode } from '../../ui/src/types';

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
}

export function createTestModeHandlers({
  send,
  state,
  hostInfo,
  findFileInfo,
}: TestHandlerDeps) {
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
      });
      return;
    }

    const { html, frontmatter, toc } = renderMarkdown(relativePath, raw);
    const fileInfo = findFileInfo(state.flatList, relativePath);

    send({
      command: 'renderContent',
      html,
      markdownSource: raw,
      frontmatter,
      toc,
      filePath: relativePath,
      relativePath: fileInfo.relativePath,
      title: fileInfo.title,
      fileList: state.flatList,
      previewInfo: null,
    });
  }

  async function sendTestReady() {
    state.flatList = virtualFiles;
    state.workspaceTree = virtualTree;
    state.currentFile = virtualFiles[0]?.relativePath ?? null;

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
      documentConversionEnabled: false,
      ...hostInfo(),
    });

    if (state.currentFile) {
      await sendTestContent(state.currentFile);
    }
  }

  return { sendTestReady, sendTestContent };
}

