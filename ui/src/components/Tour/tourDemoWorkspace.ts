import type { Action } from '../../contexts/appStateModel';
import type {
  AppRuntime,
  ContentTab,
  FolderNode,
  HostPlatform,
  MdFile,
  RenderContentMessage,
  ThemeMode,
  ThemeStyle,
  TocEntry,
} from '../../types';

export const TOUR_DEMO_WORKSPACE_PATH = '__tour_demo_workspace__';
export const TOUR_DEMO_WORKSPACE_NAME = 'Markdown Explorer Guide';

export const DEMO_FILES: MdFile[] = [
  {
    fileName: 'Welcome.md',
    title: 'Welcome to your Virtual Workspace',
    fsPath: `${TOUR_DEMO_WORKSPACE_PATH}/Welcome.md`,
    relativePath: 'Welcome.md',
    parts: ['Welcome.md'],
    extension: '.md',
    documentKind: 'markdown',
  },
];

const DEMO_TREE: FolderNode = {
  name: TOUR_DEMO_WORKSPACE_NAME,
  path: TOUR_DEMO_WORKSPACE_PATH,
  children: [],
  files: DEMO_FILES,
};

interface DemoDocEntry {
  html: string;
  markdown: string;
  toc: TocEntry[];
}

const DEMO_TOC: TocEntry[] = [
  { id: 'welcome-to-your-virtual-workspace', text: 'Welcome to your Virtual Workspace', level: 1 },
];

const DEMO_HTML = [
  '<div class="mdn-section">',
  '<h1 class="mdn-heading-1" id="welcome-to-your-virtual-workspace">Welcome to your Virtual Workspace</h1>',
  '<p>You can create, edit, and organize Markdown documents directly in your browser.</p>',
  '<ul>',
  '<li><strong>Create files &amp; folders</strong>: Use the sidebar action buttons to add new files and folders.</li>',
  '<li><strong>Instant editing</strong>: Click on any document to view or edit it.</li>',
  '<li><strong>Saved locally</strong>: Your files and edits are stored right in your browser\u2019s local storage.</li>',
  '</ul>',
  '</div>',
].join('');

const DEMO_MARKDOWN = `# Welcome to your Virtual Workspace\n\nYou can create, edit, and organize Markdown documents directly in your browser.\n\n- **Create files & folders**: Use the sidebar action buttons to add new files and folders.\n- **Instant editing**: Click on any document to view or edit it.\n- **Saved locally**: Your files and edits are stored right in your browser's local storage.\n`;

const DEMO_DOCS: Record<string, DemoDocEntry> = {
  [`${TOUR_DEMO_WORKSPACE_PATH}/Welcome.md`]: {
    toc: DEMO_TOC,
    html: DEMO_HTML,
    markdown: DEMO_MARKDOWN,
  },
};

export function isTourDemoPath(path?: string | null): boolean {
  return Boolean(path && (path === TOUR_DEMO_WORKSPACE_PATH || path.startsWith(`${TOUR_DEMO_WORKSPACE_PATH}/`)));
}

export function createTourDemoRenderAction(filePath: string): Action | null {
  if (!isTourDemoPath(filePath)) return null;
  const cleanPath = filePath.split('#')[0];
  const matched =
    DEMO_FILES.find((f) => f.fsPath === cleanPath || f.relativePath === cleanPath) ??
    DEMO_FILES[0];
  const doc = DEMO_DOCS[matched.fsPath] ?? DEMO_DOCS[DEMO_FILES[0].fsPath];
  const renderMsg: RenderContentMessage = {
    command: 'renderContent',
    filePath: matched.fsPath,
    title: matched.title,
    relativePath: matched.relativePath,
    html: doc.html,
    markdownSource: doc.markdown,
    sourceDocumentText: doc.markdown,
    frontmatter: {},
    toc: doc.toc,
    fileList: DEMO_FILES,
    previewInfo: null,
    documentWrite: {
      supported: true,
      revision: String(doc.markdown.length),
    },
  };
  return {
    type: 'RENDER_CONTENT',
    msg: renderMsg,
  };
}

export function createTourDemoWorkspaceActions(opts: {
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  appRuntime: AppRuntime;
  hostPlatform: HostPlatform;
}): Action[] {
  const primaryFile = DEMO_FILES[0];
  const demoTabs: ContentTab[] = DEMO_FILES.map((file) => {
    const doc = DEMO_DOCS[file.fsPath] ?? DEMO_DOCS[primaryFile.fsPath];
    return {
      filePath: file.fsPath,
      relativePath: file.relativePath,
      fileName: file.fileName,
      title: file.title,
      contentHtml: doc.html,
      markdownSource: doc.markdown,
      sourceDocumentText: doc.markdown,
      frontmatter: {},
      toc: doc.toc,
      previewInfo: null,
      documentWrite: {
        supported: true,
        revision: String(doc.markdown.length),
      },
    };
  });

  const renderAction = createTourDemoRenderAction(primaryFile.fsPath);

  return [
    {
      type: 'READY_ACK',
      fileList: DEMO_FILES,
      tree: DEMO_TREE,
      theme: opts.theme,
      themeStyle: opts.themeStyle,
      defaultExpanded: true,
      workspaceName: TOUR_DEMO_WORKSPACE_NAME,
      workspacePath: TOUR_DEMO_WORKSPACE_PATH,
      contentTabs: demoTabs,
      activeContentTabPath: primaryFile.fsPath,
      appRuntime: opts.appRuntime,
      hostPlatform: opts.hostPlatform,
    },
    renderAction ?? {
      type: 'RENDER_CONTENT',
      msg: {
        command: 'renderContent',
        filePath: primaryFile.fsPath,
        title: primaryFile.title,
        relativePath: primaryFile.relativePath,
        html: DEMO_DOCS[primaryFile.fsPath].html,
        markdownSource: DEMO_DOCS[primaryFile.fsPath].markdown,
        sourceDocumentText: DEMO_DOCS[primaryFile.fsPath].markdown,
        frontmatter: {},
        toc: DEMO_DOCS[primaryFile.fsPath].toc,
        fileList: DEMO_FILES,
        previewInfo: null,
        documentWrite: {
          supported: true,
          revision: String(DEMO_DOCS[primaryFile.fsPath].markdown.length),
        },
      },
    },
  ];
}

export function createTourClearDemoWorkspaceAction(opts: {
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  appRuntime: AppRuntime;
  hostPlatform: HostPlatform;
}): Action {
  return {
    type: 'READY_ACK',
    fileList: [],
    tree: null,
    theme: opts.theme,
    themeStyle: opts.themeStyle,
    defaultExpanded: true,
    workspaceName: '',
    workspacePath: undefined,
    contentTabs: [],
    activeContentTabPath: null,
    appRuntime: opts.appRuntime,
    hostPlatform: opts.hostPlatform,
  };
}
