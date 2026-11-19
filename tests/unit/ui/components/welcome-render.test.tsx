import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WelcomePage } from "../../../../ui/src/components/Content/WelcomePage";
import { WelcomeLaunchpad } from "../../../../ui/src/components/Content/WelcomeLaunchpad";
import { RandomTipCard } from "../../../../ui/src/components/Content/RandomTipCard";
import { useAppState } from "../../../../ui/src/contexts/AppStateContext";

vi.mock("../../../../ui/src/contexts/AppStateContext");

vi.mock("../../../../ui/src/contexts/welcomeTranslations", () => ({
  getWelcomeTranslations: () => ({
    hero: {
      title: "Welcome to Markdown Explorer",
      descDesktop: "A premium document reader for the desktop",
      descVSCode: "A premium document reader for VS Code",
      createdBy: "Created by",
      repository: "Repository",
      license: "License",
      desktopRecommendation: "Try the desktop app for more features",
      desktopAppLinkText: "desktop app",
      macosInstallBtn: "Install on macOS",
    },
    privacy: {
      title: "🔒 Privacy First",
      desc: "Your data stays on your machine.",
      bullets: ["No telemetry", "No cloud sync", "No analytics"],
    },
    features: {
      title: "✨ Feature Highlights",
      tree: { title: "📁 File Tree", desc: "Navigate files with a tree sidebar" },
      search: { title: "🔍 Quick Search", desc: "Find content instantly" },
      editor: { title: "✏️ Rich Markdown Editor", desc: "Edit source and tables inline" },
      tables: { title: "📋 Interactive Tables", desc: "Sort, filter, and chart data" },
      charts: { title: "📊 Table Charts", desc: "Visualize table data" },
      highlight: { title: "🎨 Syntax Highlighting", desc: "Code blocks with color" },
      insights: { title: "🕸️ Workspace Insights", desc: "Connected knowledge graph" },
      git: { title: "🌿 Git History", desc: "Browse revisions and diffs" },
      export: { title: "📤 Export Center", desc: "Export to PDF, HTML, and images" },
      outline: { title: "📑 Table of Contents", desc: "Jump across document sections" },
      bookmarks: { title: "🔖 Smart Bookmarks", desc: "Pin documents and anchors" },
      html: { title: "🌐 HTML Sandboxes", desc: "Interactive sandboxes" },
      modal: { title: "🖼️ Media Modal", desc: "Zoom images and diagrams" },
      themes: { title: "🎭 Themes & Typography", desc: "Custom themes and layouts" },
      shortcuts: {
        title: "⌨️ Keyboard Shortcuts →",
        desc: "Navigate and control the reader",
        vscodeDesc: "Shortcuts adapted for VS Code",
      },
    },
    shortcutsTable: {
      headers: { action: "Action", shortcut: "Shortcut" },
      rows: { zoomModal: "Zoom modal", zoomModalShortcut: "Scroll wheel" },
      note: "Customize shortcuts in Settings",
    },
    issues: {
      title: "🐞 Report Issues",
      hint: "Found a bug?",
      linkText: "Open an issue",
      bullets: ["Describe the problem", "Include steps to reproduce"],
    },
    tips: {
      tipToggleDesktopView: { title: "Switch Focus and Tabs views", desc: "Use {shortcut} to move between the distraction-free Focus layout and workspace Tabs without opening Settings." },
      tipToggleHtmlPreview: { title: "Toggle interactive HTML instantly", desc: "Use {shortcut} to switch the active .html or .htm document between HTML Preview and Markdown View." },
      tipOpenContainingFolder: { title: "Open the active document folder", desc: "Use {shortcut} in the desktop app to open the current document’s containing folder in Explorer, Finder, or your file manager." },
    },
  }),
}));

vi.mock("../../../../ui/src/contexts/translations", async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../ui/src/contexts/translations')>();
  const en = actual.getTranslations('en');
  return {
    ...actual,
    getTranslations: () => ({
      ...en,
      actions: {
        ...en.actions,
        findCurrentFile: "Find in current file",
        searchCurrent: "Search current workspace",
        searchAllTabs: "Search all tabs",
        back: "Back",
        forward: "Forward",
        welcome: "Welcome",
        settings: "Settings",
        toggleTheme: "Toggle theme",
        refresh: "Refresh",
        collapseAll: "Collapse all",
        expandAll: "Expand all",
        workspaceSelection: "Workspace selection",
        toggleSidebar: "Toggle sidebar",
        toggleToc: "Toggle TOC",
        zoomIn: "Zoom in",
        zoomOut: "Zoom out",
        locateFile: "Locate file",
        toggleFocusMode: "Toggle focus mode",
        toggleDesktopViewMode: "Toggle Tabs/Focus view",
        toggleFullscreen: "Show full screen",
        toggleFullscreenTooltip: "Toggle native full screen window",
        sidebarCursorMode: "Sidebar cursor mode",
      },
    }),
  };
});

vi.mock("../../../../ui/src/components/Settings/SettingsModal", () => ({
  ACTIONS_LIST: [
    { id: "findCurrentFile", label: "Find in current file", scope: "both" },
    { id: "back", label: "Back", scope: "both" },
    { id: "forward", label: "Forward", scope: "both" },
    { id: "searchCurrent", label: "Search current workspace", scope: "desktop" },
    { id: "refresh", label: "Refresh", scope: "desktop" },
    { id: "toggleSidebar", label: "Toggle sidebar", scope: "desktop" },
    { id: "toggleDesktopViewMode", label: "Toggle Tabs/Focus view", scope: "electron" },
  ],
}));

vi.mock("../../../../ui/src/components/shared/InteractiveBackground", () => ({
  InteractiveBackground: () => (
    <div data-testid="interactive-background" />
  ),
}));

function setup(overrides: Record<string, unknown> = {}) {
  vi.mocked(useAppState).mockReturnValue({
    state: {
      settings: {
        language: "en",
        keybindings: {},
        desktopViewMode: "default",
        documentConversion: false,
      },
      hostPlatform: "web",
      ...overrides,
    },
  } as any);
  return render(<WelcomePage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as Record<string, unknown>).electronAPI;
  delete (window as Record<string, unknown>).__webBus;
  delete (window as Record<string, unknown>).PlatformBridge;
});

describe("WelcomePage rendering", () => {
  it("renders hero title", () => {
    setup();
    expect(
      screen.getByText("Welcome to Markdown Explorer")
    ).toBeInTheDocument();
  });

  it("renders VS Code description when not on desktop", () => {
    setup();
    expect(
      screen.getByText("A premium document reader for VS Code")
    ).toBeInTheDocument();
  });

  it("renders desktop description when electronAPI is present", () => {
    (window as Record<string, unknown>).electronAPI = {};
    setup();
    expect(
      screen.getByText("A premium document reader for the desktop")
    ).toBeInTheDocument();
  });

  it("renders desktop description when __webBus is present", () => {
    (window as Record<string, unknown>).__webBus = {};
    setup();
    expect(
      screen.getByText("A premium document reader for the desktop")
    ).toBeInTheDocument();
  });

  it("renders tab buttons", () => {
    setup();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Tips & Practices")).toBeInTheDocument();
    expect(screen.getByText("Privacy")).toBeInTheDocument();
  });

  it("defaults to user manual tab and shows features grid when switching to features tab", () => {
    setup();
    expect(
      screen.getByRole("button", { name: /User manual/ }).className
    ).toContain("active");
    expect(document.querySelector(".manual-ai-prompt")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Features"));
    expect(
      screen.getByRole("button", { name: /Features/ }).className
    ).toContain("active");
    expect(document.querySelector(".features-grid")).toBeInTheDocument();
  });

  it("switches to shortcuts tab on click", () => {
    setup();
    fireEvent.click(screen.getByText("Shortcuts"));
    expect(document.querySelector(".shortcuts-card")).toBeInTheDocument();
    expect(document.querySelector(".features-grid")).not.toBeInTheDocument();
  });

  it("switches to tips tab on click", () => {
    setup();
    fireEvent.click(screen.getByText("Tips & Practices"));
    expect(document.querySelector(".tips-container")).toBeInTheDocument();
  });

  it("switches to privacy tab on click", () => {
    setup();
    fireEvent.click(screen.getByText("Privacy"));
    expect(document.querySelector(".privacy-support-container")).toBeInTheDocument();
  });

  it("renders InteractiveBackground", () => {
    setup();
    expect(screen.getByTestId("interactive-background")).toBeInTheDocument();
  });

  it("renders feature cards in features tab", () => {
    setup();
    fireEvent.click(screen.getByText("Features"));
    expect(screen.getByText("File Tree")).toBeInTheDocument();
    expect(screen.getByText("Quick Search")).toBeInTheDocument();
    expect(screen.getByText("Rich Markdown Editor")).toBeInTheDocument();
    expect(screen.getByText("Interactive Tables")).toBeInTheDocument();
    expect(screen.getByText("Table Charts")).toBeInTheDocument();
    expect(screen.getByText("Syntax Highlighting")).toBeInTheDocument();
    expect(screen.getByText("Workspace Insights")).toBeInTheDocument();
    expect(screen.getByText("Git History")).toBeInTheDocument();
    expect(screen.getByText("Export Center")).toBeInTheDocument();
    expect(screen.getByText("Table of Contents")).toBeInTheDocument();
    expect(screen.getByText("Smart Bookmarks")).toBeInTheDocument();
    expect(screen.getByText("HTML Sandboxes")).toBeInTheDocument();
    expect(screen.getByText(/Media Viewer/)).toBeInTheDocument();
    expect(screen.getByText("Themes & Typography")).toBeInTheDocument();
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
  });

  it("switches to shortcuts tab when View shortcuts button is clicked", () => {
    setup();
    fireEvent.click(screen.getByText("Features"));
    const viewShortcutsBtns = screen.getAllByText("View shortcuts");
    fireEvent.click(viewShortcutsBtns[0]);
    expect(document.querySelector(".shortcuts-card")).toBeInTheDocument();
  });

  it("renders shortcuts table in shortcuts tab", () => {
    setup();
    fireEvent.click(screen.getByText("Shortcuts"));
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("Shortcut")).toBeInTheDocument();
  });

  it("renders shortcuts note in shortcuts tab", () => {
    setup();
    fireEvent.click(screen.getByText("Shortcuts"));
    expect(
      screen.getByText("Customize shortcuts in Settings")
    ).toBeInTheDocument();
  });

  it("renders privacy content in privacy tab", () => {
    setup();
    fireEvent.click(screen.getByText("Privacy"));
    expect(screen.getByText("Privacy First")).toBeInTheDocument();
    expect(screen.getByText("Your data stays on your machine.")).toBeInTheDocument();
    expect(screen.getByText("No telemetry")).toBeInTheDocument();
  });

  it("renders tips content in tips tab", () => {
    setup();
    fireEvent.click(screen.getByText("Tips & Practices"));
    expect(
      screen.getByText("Quick Search vs. Find in Current File Shortcuts")
    ).toBeInTheDocument();
  });

  it("renders report issues section in privacy tab", () => {
    setup();
    fireEvent.click(screen.getByText("Privacy"));
    expect(screen.getByText("Report Issues")).toBeInTheDocument();
    expect(screen.getByText("Open an issue")).toBeInTheDocument();
  });

  it("does not render recent feature guide card in features tab", () => {
    setup();
    expect(
      screen.queryByText("What is new since v1.5.0 — v1.5.3")
    ).not.toBeInTheDocument();
  });

  it("renders desktop recommendation when not on desktop", () => {
    setup();
    expect(document.querySelector('.desktop-recommendation')).toHaveTextContent(
      "Try the desktop app for more features",
    );
  });

  it("hides desktop recommendation when on desktop", () => {
    (window as Record<string, unknown>).electronAPI = {};
    setup();
    expect(
      screen.queryByText("Try the desktop app for more features")
    ).not.toBeInTheDocument();
  });

  it("renders shortcuts for both-scope actions even on web", () => {
    setup();
    fireEvent.click(screen.getByText("Shortcuts"));
    expect(screen.getByText("Find in current file")).toBeInTheDocument();
  });

  it("only shows desktop-scope shortcuts on desktop", () => {
    (window as Record<string, unknown>).electronAPI = {};
    setup();
    fireEvent.click(screen.getByText("Shortcuts"));
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("hides desktop-scope shortcuts on web", () => {
    setup();
    fireEvent.click(screen.getByText("Shortcuts"));
    expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
  });

  it("shows the desktop view toggle shortcut only in the desktop app", () => {
    (window as Record<string, unknown>).electronAPI = {};
    setup();
    fireEvent.click(screen.getByText("Shortcuts"));
    expect(screen.getByText("Toggle Tabs/Focus view")).toBeInTheDocument();
  });

  it("hides the desktop view toggle shortcut outside the desktop app", () => {
    setup();
    fireEvent.click(screen.getByText("Shortcuts"));
    expect(screen.queryByText("Toggle Tabs/Focus view")).not.toBeInTheDocument();
  });

  it("shows fixed F11 fullscreen shortcut only on desktop", () => {
    (window as Record<string, unknown>).electronAPI = {};
    setup();
    fireEvent.click(screen.getByText("Shortcuts"));
    expect(screen.getByText("Show full screen")).toBeInTheDocument();
    expect(screen.getByText("F11")).toBeInTheDocument();
  });

  it("shows macOS install link only on desktop + macos", () => {
    (window as Record<string, unknown>).electronAPI = {};
    setup({ hostPlatform: "macos" });
    expect(screen.getByText("Install on macOS")).toBeInTheDocument();
  });

  it("hides macOS install link on non-macos desktop", () => {
    (window as Record<string, unknown>).electronAPI = {};
    setup({ hostPlatform: "windows" });
    expect(screen.queryByText("Install on macOS")).not.toBeInTheDocument();
  });

  it("applies active class to clicked tab button", () => {
    setup();
    const tipsBtn = screen.getByText("Tips & Practices");
    fireEvent.click(tipsBtn);
    expect(tipsBtn.closest(".tab-btn")?.className).toContain("active");
  });

  it("removes active class from previously active tab", () => {
    setup();
    const manualBtn = screen.getByText("User manual").closest(".tab-btn");
    expect(manualBtn?.className).toContain("active");
    fireEvent.click(screen.getByText("Tips & Practices"));
    expect(manualBtn?.className).not.toContain("active");
  });

  it("renders featured random tip card with shuffle button", () => {
    setup();
    render(<RandomTipCard />);
    const card = screen.getByTestId("empty-workspace-random-tip");
    expect(card).toBeInTheDocument();

    const shuffleBtn = screen.getByRole("button", { name: /Another Tip/i });
    expect(shuffleBtn).toBeInTheDocument();
    fireEvent.click(shuffleBtn);
    expect(card).toBeInTheDocument();
  });

  it("renders GitHub star persuasion banner with link in WelcomeHero", () => {
    setup();
    const starBanner = screen.getByRole("region", { name: /Support Markdown Explorer/i });
    expect(starBanner).toBeInTheDocument();
    const starLink = screen.getByRole("link", { name: /Star on GitHub/i });
    expect(starLink).toBeInTheDocument();
    expect(starLink).toHaveAttribute("href", "https://github.com/the-long-ride/markdown-explorer");
    expect(screen.getByTestId("github-star-count")).toHaveTextContent("15");
    const donateLink = screen.getByRole("link", { name: /^Donate$/i });
    expect(donateLink).toHaveAttribute("href", "https://github.com/the-long-ride#donate");
    expect(donateLink).toHaveAttribute("target", "_blank");
  });

  it("renders command deck and launchpad inside WelcomePage", () => {
    setup();
    expect(document.querySelector(".welcome-command-deck")).toBeInTheDocument();
    expect(screen.getByTestId("welcome-launchpad")).toBeInTheDocument();
    expect(document.querySelector('[data-tour-id="welcome-launchpad"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tour-id="welcome-tabs-bar"]')).toBeInTheDocument();
  });

  it("dispatches markdown-explorer-start-tour when tour-trigger button is clicked", () => {
    setup();
    const tourHandler = vi.fn();
    window.addEventListener("markdown-explorer-start-tour", tourHandler);

    const tourBtn = document.querySelector('[data-tour-id="tour-trigger"]');
    expect(tourBtn).toBeInTheDocument();
    fireEvent.click(tourBtn!);

    expect(tourHandler).toHaveBeenCalledTimes(1);
    window.removeEventListener("markdown-explorer-start-tour", tourHandler);
  });

  it("switches active tab when markdown-explorer-welcome-select-tab event is dispatched", () => {
    setup();
    expect(screen.getByRole("button", { name: /User manual/i }).className).toContain("active");

    fireEvent(
      window,
      new CustomEvent("markdown-explorer-welcome-select-tab", { detail: "features" })
    );

    expect(screen.getByRole("button", { name: /User manual/i }).className).not.toContain("active");
    expect(screen.getByRole("button", { name: /Features/i }).className).toContain("active");
  });

  it("renders minimized website button with URL tooltip and collapsible open-source ecosystem (collapsed by default)", () => {
    setup();
    const websiteLink = screen.getByRole("link", { name: /Website/i });
    expect(websiteLink).toHaveAttribute("href", "https://the-long-ride.github.io/markdown-explorer");
    expect(websiteLink).toHaveAttribute(
      "data-hover-tooltip",
      "https://the-long-ride.github.io/markdown-explorer"
    );

    const toggleBtn = screen.getByTestId("welcome-ecosystem-toggle");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("markdown-them")).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    expect(screen.getByText("markdown-them")).toBeInTheDocument();
    expect(screen.getByText("aevra")).toBeInTheDocument();
    expect(screen.getByText("aevra-desktop-use")).toBeInTheDocument();
    expect(screen.getByText("aevra-browser-use")).toBeInTheDocument();
    expect(screen.getByText("engram")).toBeInTheDocument();
    expect(screen.getByText("quotashift")).toBeInTheDocument();

    const items = document.querySelectorAll(".welcome-ecosystem__item");
    expect(items.length).toBe(6);
    items.forEach((item) => {
      expect(item.querySelectorAll(".welcome-ecosystem__item-tag").length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("WelcomeLaunchpad Option A 2-Tier Command Header & Recents", () => {
    it("renders structured 2-tier command header with active workspace status, quick tools, and primary action buttons", () => {
      const postMessage = vi.fn();
      (window as any).PlatformBridge = { postMessage };

      render(
        <WelcomeLaunchpad
          language="en"
          isDesktop={true}
          workspaceName="markdown-workspace"
          fileCount={18}
          recentWorkspaces={[
            { name: "markdown-workspace", path: "/repos/markdown-workspace" },
            { name: "docs-repo", path: "/repos/docs-repo" },
          ]}
        />
      );

      // Tier 1: Context & Utility Header
      const header = document.querySelector(".welcome-launchpad__header");
      expect(header).toBeInTheDocument();

      const statusPill = document.querySelector(".welcome-launchpad__workspace-status");
      expect(statusPill).toBeInTheDocument();

      const statusDot = document.querySelector(".welcome-launchpad__status-dot");
      expect(statusDot).toHaveClass("is-active");

      const wsName = screen.getByText("markdown-workspace");
      expect(wsName).toHaveAttribute("data-hover-tooltip", "markdown-workspace");
      expect(screen.getByText(/18\s+files/i)).toBeInTheDocument();

      // Quick grid in Tier 1
      const quickGrid = document.querySelector(".welcome-launchpad__quick-grid");
      expect(quickGrid).toBeInTheDocument();
      expect(document.querySelector(".welcome-launchpad__tour-btn")).toBeInTheDocument();
      expect(document.querySelector(".welcome-launchpad__quick-btn")).toBeInTheDocument();

      // Tier 2: Primary Actions
      const primaryActions = document.querySelector(".welcome-launchpad__primary-actions");
      expect(primaryActions).toBeInTheDocument();

      const openFolderBtn = screen.getByRole("button", { name: /Open Folder/i });
      expect(openFolderBtn).toHaveClass("welcome-launchpad__action-btn--primary");

      const openFileBtn = screen.getByRole("button", { name: /Open File/i });
      expect(openFileBtn).toHaveClass("welcome-launchpad__action-btn--secondary");

      const switchWsBtn = screen.getByRole("button", { name: /workspace selection|Switch Workspace/i });
      expect(switchWsBtn).toHaveClass("welcome-launchpad__action-btn--secondary");

      // Recents deduplication: "markdown-workspace" should NOT be in recents chips
      const recentChips = document.querySelectorAll(".welcome-launchpad__recent-item");
      expect(recentChips.length).toBe(1);
      expect(screen.getByText("docs-repo")).toBeInTheDocument();
      expect(screen.queryAllByText("markdown-workspace").length).toBe(1); // Only in status pill!
    });

    it("renders muted status dot and placeholder when workspaceName is not set", () => {
      render(
        <WelcomeLaunchpad
          language="en"
          isDesktop={true}
        />
      );

      const statusDot = document.querySelector(".welcome-launchpad__status-dot");
      expect(statusDot).not.toHaveClass("is-active");
      expect(screen.getByText(/All-in-one Markdown workspace|Select a workspace/i)).toBeInTheDocument();
    });

    it("triggers bridge postMessage on Open Folder and Open File when bridge is available", () => {
      const postMessage = vi.fn();
      (window as any).PlatformBridge = { postMessage };

      render(
        <WelcomeLaunchpad
          language="en"
          isDesktop={true}
          workspaceName="test-project"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Open Folder/i }));
      expect(postMessage).toHaveBeenCalledWith({ command: "openFolder", openFirstFile: false });

      fireEvent.click(screen.getByRole("button", { name: /Open File/i }));
      expect(postMessage).toHaveBeenCalledWith({ command: "openFile" });
    });

    it("dispatches open-workspace-selection on Open Folder when bridge is absent", () => {
      const wsHandler = vi.fn();
      window.addEventListener("open-workspace-selection", wsHandler);

      render(
        <WelcomeLaunchpad
          language="en"
          isDesktop={false}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /Open Folder/i }));
      expect(wsHandler).toHaveBeenCalledTimes(1);

      window.removeEventListener("open-workspace-selection", wsHandler);
    });

    it("dispatches open-workspace-selection on Switch Workspace button click", () => {
      const wsHandler = vi.fn();
      window.addEventListener("open-workspace-selection", wsHandler);

      render(
        <WelcomeLaunchpad
          language="en"
          isDesktop={true}
          workspaceName="active-workspace"
        />
      );

      const switchWsBtn = screen.getByRole("button", { name: /workspace selection|Switch Workspace/i });
      fireEvent.click(switchWsBtn);
      expect(wsHandler).toHaveBeenCalledTimes(1);

      window.removeEventListener("open-workspace-selection", wsHandler);
    });

    it("triggers openRecentWorkspace when a recent workspace chip is clicked", () => {
      const postMessage = vi.fn();
      (window as any).PlatformBridge = { postMessage };

      render(
        <WelcomeLaunchpad
          language="en"
          isDesktop={true}
          workspaceName="active-ws"
          recentWorkspaces={[
            { name: "other-project", path: "/repos/other-project" }
          ]}
        />
      );

      const recentChip = screen.getByRole("button", { name: /other-project/i });
      fireEvent.click(recentChip);
      expect(postMessage).toHaveBeenCalledWith({
        command: "openRecentWorkspace",
        path: "/repos/other-project",
        openFirstFile: false,
      });
    });

    it("hides recents section when all recent workspaces match the active workspace", () => {
      render(
        <WelcomeLaunchpad
          language="en"
          isDesktop={true}
          workspaceName="duplicate-ws"
          recentWorkspaces={[
            { name: "duplicate-ws", path: "/repos/duplicate-ws" }
          ]}
        />
      );

      expect(document.querySelector(".welcome-launchpad__section--recents")).not.toBeInTheDocument();
    });

    it("dispatches open-settings when Settings button is clicked", () => {
      const settingsHandler = vi.fn();
      window.addEventListener("open-settings", settingsHandler);

      render(
        <WelcomeLaunchpad
          language="en"
          isDesktop={true}
        />
      );

      const settingsBtn = document.querySelector(".welcome-launchpad__quick-btn");
      expect(settingsBtn).toBeInTheDocument();
      fireEvent.click(settingsBtn!);

      expect(settingsHandler).toHaveBeenCalledTimes(1);
      window.removeEventListener("open-settings", settingsHandler);
    });

    it("renders New Virtual Workspace, Open Folder, and Open File buttons in Web Mode and dispatches createVirtualWorkspace", () => {
      const origLocation = window.location;
      delete (window as any).location;
      window.location = new URL("https://example.com/?mode=web") as any;
      (window as any).__webBus = new EventTarget();

      const postMessage = vi.fn();
      (window as any).PlatformBridge = { postMessage };

      render(
        <WelcomeLaunchpad
          language="en"
          isDesktop={false}
        />
      );

      const virtualBtn = screen.getByTestId("welcome-create-virtual-workspace-btn");
      expect(virtualBtn).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Open Folder/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Open File/i })).toBeInTheDocument();

      fireEvent.click(virtualBtn);
      expect(postMessage).toHaveBeenCalledWith({
        command: "createVirtualWorkspace",
        type: "createVirtualWorkspace",
      });

      delete (window as any).__webBus;
      delete (window as any).PlatformBridge;
      window.location = origLocation;
    });
  });
});
