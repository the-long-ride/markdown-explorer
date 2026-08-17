import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Content } from "../../../../ui/src/components/Content/Content";
import { useAppState } from "../../../../ui/src/contexts/AppStateContext";
import { useNavigation } from "../../../../ui/src/contexts/NavigationContext";
import { usePlatform } from "../../../../ui/src/contexts/PlatformContext";
import { resetReadingProgressForTests } from "../../../../ui/src/readingProgress/readingProgressStore";
import { rememberHeadingState } from "../../../../ui/src/readingProgress/readingProgressStore";
import { getWorkspaceScopeKey } from "../../../../ui/src/contexts/contentTabState";

vi.mock("../../../../ui/src/contexts/AppStateContext");
vi.mock("../../../../ui/src/contexts/NavigationContext");
vi.mock("../../../../ui/src/contexts/PlatformContext");

vi.mock("../../../../ui/src/contexts/translations", async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../ui/src/contexts/translations')>();
  const en = actual.getTranslations('en');
  return {
    ...actual,
    getTranslations: () => ({
      ...en,
      tooltips: { ...en.tooltips, cancelScan: 'Cancel scan' },
      previewActions: { ...en.previewActions, openInBrowser: 'Open in browser', openAsModal: 'Open as modal', showCode: 'Show code', showPreview: 'Show preview', copyCode: 'Copy code', plainText: 'Plain text', csvPreviewTitle: 'CSV Preview', tsvPreviewTitle: 'TSV Preview', csvMalformedQuote: 'Malformed CSV', csvUnevenRows: 'Uneven rows', modalTitle: 'HTML preview', closeModal: 'Close', openError: 'Unable to open', linkMenu: 'Link actions', copyLink: 'Copy link', linkCopied: 'Link copied', unableToOpenLink: 'Unable to open link', copyFailed: 'Unable to copy link' },
      workspaceUnavailable: { ...en.workspaceUnavailable, title: 'Workspace not found', description: 'The current path no longer exists or is locked. Please open the workspace again.', tabHint: 'Tab view: choose a replacement folder to reuse this tab.', openAgain: 'Open Workspace Again', deleteHistory: 'Delete from History', removedHistory: 'Removed from History' },
      documentPreview: { ...en.documentPreview, currentFileChangedOnDisk: "Current file changed on disk", refreshCurrentFile: "Refresh", currentFileChangedSuffix: "Click to reload.", convertedTitle: "Converted: {sourceLabel}", textTitle: "Text: {sourceLabel}", convertedWarning: "Converted warning", legacyBestEffortWarning: "Legacy best-effort warning", textWarning: "Text warning", conversionFailedWarning: "Conversion failed", durationMeta: "{status} in {duration}", preparedLocally: "prepared locally", loadedCachedConversion: "loaded from cache" },
    }),
  };
});

vi.mock("../../../../ui/src/lib/renderLibs", () => ({
  getChart: vi.fn(),
  getHighlightJs: vi.fn(),
  getKatex: vi.fn(),
  getMermaid: vi.fn(),
}));

vi.mock("../../../../ui/src/components/Content/WelcomePage", () => ({
  WelcomePage: () => <div data-testid="welcome-page">WelcomePage</div>,
}));

vi.mock("../../../../ui/src/components/TOC/TableOfContents", () => ({
  TableOfContents: ({ variant }: { variant: string }) => (
    <div data-testid={`toc-${variant}`}>TableOfContents {variant}</div>
  ),
}));

vi.mock("../../../../ui/src/components/shared/icons", () => ({
  AlertTriangleIcon: ({ size }: { size?: number }) => (
    <svg data-testid="alert-triangle-icon" width={size} height={size} />
  ),
  FolderIcon: ({ size }: { size?: number }) => (
    <svg data-testid="folder-icon" width={size} height={size} />
  ),
  FileNotFoundIcon: ({ size }: { size?: number }) => (
    <svg data-testid="file-not-found-icon" width={size} height={size} />
  ),
  TrashIcon: ({ size }: { size?: number }) => (
    <svg data-testid="trash-icon" width={size} height={size} />
  ),
}));

const mockNavigate = vi.fn();
const mockRefresh = vi.fn();
const mockUpdateSettings = vi.fn();
const mockPush = vi.fn();
const mockPostMessage = vi.fn();

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    fileList: [{ path: "/readme.md" }],
    tree: null,
    currentFile: null,
    theme: "light" as const,
    hasThemePreference: false,
    themeStyle: "default" as const,
    hasThemeStylePreference: false,
    defaultExpanded: true,
    workspaceName: "test",
    workspacePath: "/test",
    sidebarCollapsed: false,
    tocCollapsed: false,
    contentHtml: "",
    markdownSource: null,
    frontmatter: {},
    toc: [],
    relativePath: "",
    isLoading: false,
    loadingLabel: "",
    loadingDetail: "",
    previewInfo: null,
    staleContentFilePath: null,
    notFoundHref: null,
    workspaceUnavailablePath: null,
    workspaceUnavailableReason: null,
    settings: {
      language: "en",
      keybindings: {},
      desktopViewMode: "default",
      documentConversion: false,
    },
    renderVersion: 1,
    contentTabs: [],
    activeContentTabPath: null,
    recentWorkspaces: [],
    isMaximized: false,
    appVersion: "1.0.0",
    appRuntime: "web" as const,
    hostPlatform: "web" as const,
    hostArch: "x64",
    focusMode: false,
    updateState: { status: "idle" },
    sidebarActiveTab: "files" as const,
    ...overrides,
  };
}

function setup(overrides: Record<string, unknown> = {}) {
  vi.mocked(useAppState).mockReturnValue({
    state: makeState(overrides),
    navigate: mockNavigate,
    refresh: mockRefresh,
    updateSettings: mockUpdateSettings,
  });
  vi.mocked(useNavigation).mockReturnValue({ push: mockPush });
  vi.mocked(usePlatform).mockReturnValue({ postMessage: mockPostMessage });

  const scrollRef = { current: null } as React.RefObject<HTMLDivElement | null>;
  const onImageClick = vi.fn();

  return render(
    <Content onImageClick={onImageClick} scrollRef={scrollRef} />
  );
}

function setupWithProps(
  overrides: Record<string, unknown> = {},
  props: { suppressWelcome?: boolean; onOpenWorkspaceAgain?: (oldPath: string) => void; onCancelWorkspaceScan?: () => void } = {}
) {
  vi.mocked(useAppState).mockReturnValue({
    state: makeState(overrides),
    navigate: mockNavigate,
    refresh: mockRefresh,
    updateSettings: mockUpdateSettings,
  });
  vi.mocked(useNavigation).mockReturnValue({ push: mockPush });
  vi.mocked(usePlatform).mockReturnValue({ postMessage: mockPostMessage });

  const scrollRef = { current: null } as React.RefObject<HTMLDivElement | null>;
  const onImageClick = vi.fn();

  return render(
    <Content
      onImageClick={onImageClick}
      scrollRef={scrollRef}
      suppressWelcome={props.suppressWelcome}
      onOpenWorkspaceAgain={props.onOpenWorkspaceAgain}
      onCancelWorkspaceScan={props.onCancelWorkspaceScan}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as Record<string, unknown>).electronAPI;
  resetReadingProgressForTests();
});

describe("Content rendering", () => {
  it("renders loading spinner when isLoading", () => {
    const { container } = setup({ isLoading: true });
    expect(container.querySelector(".spinner")).toBeInTheDocument();
    expect(screen.getByText("Loading docs…")).toBeInTheDocument();
  });

  it("renders custom loading label", () => {
    setup({ isLoading: true, loadingLabel: "Scanning workspace..." });
    expect(screen.getByText("Scanning workspace...")).toBeInTheDocument();
  });

  it("renders loading detail when provided", () => {
    setup({ isLoading: true, loadingDetail: "Please wait" });
    expect(screen.getByText("Please wait")).toBeInTheDocument();
  });

  it("renders not found screen when notFoundHref is set", () => {
    setup({ notFoundHref: "/missing/file.md" });
    expect(screen.getByText("File not found")).toBeInTheDocument();
    expect(screen.getByText("/missing/file.md")).toBeInTheDocument();
  });

  it("renders workspace unavailable with Open Workspace Again button", () => {
    setup({
      workspaceUnavailablePath: "/gone/workspace",
      recentWorkspaces: [{ path: "/gone/workspace" }],
    });
    expect(screen.getByText("Workspace not found")).toBeInTheDocument();
    expect(screen.getByText("/gone/workspace")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open Workspace Again/i })
    ).toBeInTheDocument();
  });

  it("renders Delete from History button when workspace is in recents", () => {
    setup({
      workspaceUnavailablePath: "/gone/workspace",
      recentWorkspaces: [{ path: "/gone/workspace" }],
    });
    expect(
      screen.getByRole("button", { name: /Delete from History/i })
    ).toBeInTheDocument();
  });

  it("disables delete button when workspace not in recents", () => {
    setup({
      workspaceUnavailablePath: "/gone/workspace",
      recentWorkspaces: [],
    });
    expect(
      screen.getByRole("button", { name: /Removed from History/i })
    ).toBeDisabled();
  });

  it("sends openFolder message when Open Workspace Again is clicked", () => {
    setup({
      workspaceUnavailablePath: "/gone/workspace",
      recentWorkspaces: [],
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Open Workspace Again/i })
    );
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: "openFolder",
      openFirstFile: false,
      replaceRecentWorkspacePath: "/gone/workspace",
    });
  });

  it("uses the tab-scoped recovery callback when provided", () => {
    const onOpenWorkspaceAgain = vi.fn();
    setupWithProps(
      { workspaceUnavailablePath: "/gone/workspace", recentWorkspaces: [] },
      { onOpenWorkspaceAgain },
    );

    fireEvent.click(screen.getByRole("button", { name: /Open Workspace Again/i }));

    expect(onOpenWorkspaceAgain).toHaveBeenCalledWith("/gone/workspace");
    expect(mockPostMessage).not.toHaveBeenCalledWith(expect.objectContaining({ command: "openFolder" }));
  });

  it("sends deleteRecentWorkspace when delete button is clicked", () => {
    setup({
      workspaceUnavailablePath: "/gone/workspace",
      recentWorkspaces: [{ path: "/gone/workspace" }],
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Delete from History/i })
    );
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: "deleteRecentWorkspace",
      path: "/gone/workspace",
    });
  });

  it("renders RandomTipCard when all document files are closed in an open workspace", () => {
    setupWithProps(
      { fileList: ["doc1.md", "doc2.md"], currentFile: null },
      { suppressWelcome: true },
    );
    expect(screen.getByTestId("empty-workspace-random-tip")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Another Tip/i })).toBeInTheDocument();
  });

  it("renders tab-view hint for unavailable workspace in desktop tab view", () => {
    (window as Record<string, unknown>).electronAPI = {};
    setup({
      workspaceUnavailablePath: "/gone",
      settings: {
        language: "en",
        keybindings: {},
        desktopViewMode: "tabs",
        documentConversion: false,
      },
    });
    expect(screen.getByText(/Tab view:/i)).toBeInTheDocument();
  });

  it("renders empty workspace message when no files and no content", () => {
    setup({ fileList: [], contentHtml: "" });
    expect(
      screen.getByText("No Markdown, MDX, or TXT files found")
    ).toBeInTheDocument();
    expect(screen.getByTestId("file-not-found-icon")).toBeInTheDocument();
    expect(screen.queryByText("📁")).not.toBeInTheDocument();
  });

  it("does not render the empty workspace while scanning", () => {
    setup({ fileList: [], contentHtml: "", isWorkspaceScanning: true });
    expect(
      screen.queryByText("No Markdown, MDX, or TXT files found")
    ).not.toBeInTheDocument();
  });

  it("renders document conversion empty message when enabled", () => {
    setup({
      fileList: [],
      contentHtml: "",
      settings: {
        language: "en",
        keybindings: {},
        desktopViewMode: "default",
        documentConversion: true,
      },
    });
    expect(
      screen.getByText("No supported documents found")
    ).toBeInTheDocument();
  });

  it("renders enable document conversion button when conversion is off", () => {
    setup({ fileList: [], contentHtml: "" });
    expect(
      screen.getByRole("button", { name: /Enable document conversion/i })
    ).toBeInTheDocument();
  });

  it("hides enable document conversion button when conversion is on", () => {
    setup({
      fileList: [],
      contentHtml: "",
      settings: {
        language: "en",
        keybindings: {},
        desktopViewMode: "default",
        documentConversion: true,
      },
    });
    expect(
      screen.queryByRole("button", { name: /Enable document conversion/i })
    ).not.toBeInTheDocument();
  });

  it("calls updateSettings when enable document conversion button is clicked", () => {
    setup({ fileList: [], contentHtml: "" });
    fireEvent.click(
      screen.getByRole("button", { name: /Enable document conversion/i })
    );
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      documentConversion: true,
    });
  });

  it("renders welcome page when no current file and files exist", () => {
    setup({ fileList: [{ path: "/readme.md" }], currentFile: null });
    expect(screen.getByTestId("welcome-page")).toBeInTheDocument();
  });

  it("hides welcome page when suppressWelcome is true", () => {
    setupWithProps(
      { fileList: [{ path: "/readme.md" }], currentFile: null },
      { suppressWelcome: true }
    );
    expect(screen.queryByTestId("welcome-page")).not.toBeInTheDocument();
  });

  it("renders content body when currentFile exists", () => {
    const { container } = setup({
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
    });
    expect(container.querySelector(".mdn-body")).toBeInTheDocument();
  });


  it("restores persisted heading collapse from the reading progress store", () => {
    rememberHeadingState(
      getWorkspaceScopeKey("/test", "test"),
      "/readme.md",
      new Map([["title", false]]),
    );
    const { container } = setup({
      currentFile: "/readme.md",
      contentHtml: '<section class="mdn-section" id="title" data-expanded="true"><div class="mdn-section-header" role="button" tabindex="0" aria-expanded="true"><h1>Title</h1></div><div class="mdn-section-body">Body</div></section>',
    });
    const section = container.querySelector<HTMLElement>(".mdn-section")!;
    expect(section.dataset.expanded).toBe("false");
  });

  it("toggles heading sections through delegated click handling", () => {
    const { container } = setup({
      currentFile: "/readme.md",
      contentHtml: '<section class="mdn-section" id="title" data-expanded="true"><div class="mdn-section-header" role="button" tabindex="0" aria-expanded="true"><h1>Title</h1></div><div class="mdn-section-body">Body</div></section>',
    });
    const section = container.querySelector<HTMLElement>(".mdn-section")!;
    const header = container.querySelector<HTMLElement>(".mdn-section-header")!;

    fireEvent.click(header);

    expect(section.dataset.expanded).toBe("false");
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles heading sections when the chevron SVG is clicked", () => {
    const { container } = setup({
      currentFile: "/readme.md",
      contentHtml: '<section class="mdn-section" id="title" data-expanded="true"><div class="mdn-section-header" role="button" tabindex="0" aria-expanded="true"><h1>Title</h1><span class="mdn-section-chevron"><svg><path d="M0 0"></path></svg></span></div><div class="mdn-section-body">Body</div></section>',
    });
    const section = container.querySelector<HTMLElement>(".mdn-section")!;
    const path = container.querySelector<SVGPathElement>(".mdn-section-chevron path")!;

    fireEvent.click(path);

    expect(section.dataset.expanded).toBe("false");
  });

  it("toggles heading sections with Enter", () => {
    const { container } = setup({
      currentFile: "/readme.md",
      contentHtml: '<section class="mdn-section" id="title" data-expanded="true"><div class="mdn-section-header" role="button" tabindex="0" aria-expanded="true"><h1>Title</h1></div><div class="mdn-section-body">Body</div></section>',
    });
    const section = container.querySelector<HTMLElement>(".mdn-section")!;
    const header = container.querySelector<HTMLElement>(".mdn-section-header")!;

    fireEvent.keyDown(header, { key: "Enter" });

    expect(section.dataset.expanded).toBe("false");
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("preserves a heading state across content rerenders", () => {
    let currentState = makeState({
      currentFile: "/readme.md",
      contentHtml: '<section class="mdn-section" id="title" data-expanded="true"><div class="mdn-section-header" role="button" tabindex="0" aria-expanded="true"><h1>Title</h1></div><div class="mdn-section-body">One</div></section>',
    });
    vi.mocked(useAppState).mockImplementation(() => ({
      state: currentState,
      navigate: mockNavigate,
      refresh: mockRefresh,
      updateSettings: mockUpdateSettings,
    }));
    vi.mocked(useNavigation).mockReturnValue({ push: mockPush });
    vi.mocked(usePlatform).mockReturnValue({ postMessage: mockPostMessage });
    const scrollRef = { current: null } as React.RefObject<HTMLDivElement | null>;
    const onImageClick = vi.fn();
    const view = render(<Content onImageClick={onImageClick} scrollRef={scrollRef} />);

    fireEvent.click(view.container.querySelector<HTMLElement>(".mdn-section-header")!);
    expect(view.container.querySelector<HTMLElement>(".mdn-section")!.dataset.expanded).toBe("false");

    currentState = makeState({
      currentFile: "/readme.md",
      renderVersion: 2,
      contentHtml: '<section class="mdn-section" id="title" data-expanded="true"><div class="mdn-section-header" role="button" tabindex="0" aria-expanded="true"><h1>Title</h1></div><div class="mdn-section-body">Two</div></section>',
    });
    view.rerender(<Content onImageClick={onImageClick} scrollRef={scrollRef} />);

    expect(view.container.querySelector<HTMLElement>(".mdn-section")!.dataset.expanded).toBe("false");
    expect(view.container.querySelector<HTMLElement>(".mdn-section-header")).toHaveAttribute("aria-expanded", "false");
  });

  it("renders stale file notice when staleContentFilePath matches currentFile", () => {
    setup({
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
      staleContentFilePath: "/readme.md",
    });
    expect(
      screen.getByText("Current file changed on disk")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Refresh/i })
    ).toBeInTheDocument();
  });

  it("hides stale file notice when staleContentFilePath differs from currentFile", () => {
    setup({
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
      staleContentFilePath: "/other.md",
    });
    expect(
      screen.queryByText("Current file changed on disk")
    ).not.toBeInTheDocument();
  });

  it("renders frontmatter entries", () => {
    setup({
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
      frontmatter: { title: "Test", author: "Bot" },
    });
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("author")).toBeInTheDocument();
    expect(screen.getByText("Bot")).toBeInTheDocument();
  });

  it("renders document properties in an open key/value disclosure", () => {
    const { container } = setup({
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
      frontmatter: { id: "knowledge-1", tags: "[docs, rendering]" },
    });

    const properties = container.querySelector("details.mdn-frontmatter");
    expect(properties).not.toBeNull();
    if (!properties) throw new Error("properties disclosure was not rendered");
    expect(properties.tagName).toBe("DETAILS");
    expect(properties).toHaveAttribute("open");
    expect(screen.getByText("2 properties")).toBeInTheDocument();
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("knowledge-1")).toBeInTheDocument();
    expect(screen.getByText("tags")).toBeInTheDocument();
    expect(screen.getByText("[docs, rendering]")).toBeInTheDocument();
  });

  it("renders converted preview info notice", () => {
    setup({
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
      previewInfo: {
        kind: "converted",
        sourceLabel: "report.docx",
        qualityWarning: undefined,
        durationMs: 1500,
        fromCache: false,
      },
    });
    expect(screen.getByText("Converted: report.docx")).toBeInTheDocument();
    expect(screen.getByText("Converted warning")).toBeInTheDocument();
  });

  it("renders the localized legacy best-effort warning", () => {
    setup({
      currentFile: "/legacy.xls",
      contentHtml: "<h1>Legacy</h1>",
      previewInfo: {
        kind: "converted",
        sourceLabel: "legacy.xls",
        qualityCode: "legacy-best-effort",
        qualityWarning: "host fallback",
      },
    });
    expect(screen.getByText("Legacy best-effort warning")).toBeInTheDocument();
    expect(screen.queryByText("host fallback")).not.toBeInTheDocument();
  });

  it("renders text preview info notice", () => {
    setup({
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
      previewInfo: {
        kind: "text",
        sourceLabel: "notes.txt",
        qualityWarning: undefined,
        durationMs: 200,
        fromCache: true,
      },
    });
    expect(screen.getByText("Text: notes.txt")).toBeInTheDocument();
    expect(screen.getByText("Text warning")).toBeInTheDocument();
  });

  it("does not render content body when isLoading", () => {
    const { container } = setup({
      isLoading: true,
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
    });
    expect(container.querySelector(".mdn-body")).not.toBeInTheDocument();
  });

  it("does not render content body when notFoundHref is set", () => {
    const { container } = setup({
      notFoundHref: "/missing.md",
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
    });
    expect(container.querySelector(".mdn-body")).not.toBeInTheDocument();
  });

  it("does not render content body when workspaceUnavailablePath is set", () => {
    const { container } = setup({
      workspaceUnavailablePath: "/gone",
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
    });
    expect(container.querySelector(".mdn-body")).not.toBeInTheDocument();
  });

  it("renders main content wrapper element", () => {
    setup();
    expect(document.querySelector("main.content")).toBeInTheDocument();
  });

  it("renders compact TableOfContents inside content body when toc items exist", async () => {
    setup({
      currentFile: "/readme.md",
      contentHtml: "<h1>Hello</h1>",
      toc: [{ level: 1, text: "Introduction", id: "introduction" }],
    });
    expect(await screen.findByTestId("toc-compact")).toBeInTheDocument();
  });
});
