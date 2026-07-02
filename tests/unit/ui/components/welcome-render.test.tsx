import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WelcomePage } from "../../../../ui/src/components/Content/WelcomePage";
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
      tables: { title: "📋 Interactive Tables", desc: "Sort, filter, and chart data" },
      charts: { title: "📊 Table Charts", desc: "Visualize table data" },
      highlight: { title: "🎨 Syntax Highlighting", desc: "Code blocks with color" },
      modal: { title: "🖼️ Media Modal", desc: "Zoom images and diagrams" },
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
  }),
}));

vi.mock("../../../../ui/src/contexts/translations", () => ({
  getTranslations: () => ({
    actions: {
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
      sidebarCursorMode: "Sidebar cursor mode",
    },
  }),
}));

vi.mock("../../../../ui/src/components/Settings/SettingsModal", () => ({
  ACTIONS_LIST: [
    { id: "findCurrentFile", label: "Find in current file", scope: "both" },
    { id: "back", label: "Back", scope: "both" },
    { id: "forward", label: "Forward", scope: "both" },
    { id: "searchCurrent", label: "Search current workspace", scope: "desktop" },
    { id: "refresh", label: "Refresh", scope: "desktop" },
    { id: "toggleSidebar", label: "Toggle sidebar", scope: "desktop" },
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
  delete (window as Record<string, unknown>).__chromeExtBus;
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

  it("renders tab buttons", () => {
    setup();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Tips & Practices")).toBeInTheDocument();
    expect(screen.getByText("Privacy")).toBeInTheDocument();
  });

  it("defaults to features tab", () => {
    setup();
    expect(
      screen.getByRole("button", { name: /Features/ }).className
    ).toContain("active");
  });

  it("shows features grid by default", () => {
    setup();
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
    expect(screen.getByText("File Tree")).toBeInTheDocument();
    expect(screen.getByText("Quick Search")).toBeInTheDocument();
    expect(screen.getByText("Interactive Tables")).toBeInTheDocument();
    expect(screen.getByText("Table Charts")).toBeInTheDocument();
    expect(screen.getByText("Syntax Highlighting")).toBeInTheDocument();
    expect(screen.getByText(/Media Modal/)).toBeInTheDocument();
  });

  it("switches to shortcuts tab when View shortcuts button is clicked", () => {
    setup();
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

  it("renders recent feature guide card in features tab", () => {
    setup();
    expect(
      screen.getByText("What is new since v1.5.0 — v1.5.3")
    ).toBeInTheDocument();
  });

  it("renders desktop recommendation when not on desktop", () => {
    setup();
    expect(
      screen.getByText("Try the desktop app for more features")
    ).toBeInTheDocument();
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
    const featuresBtn = screen.getByText("Features").closest(".tab-btn");
    expect(featuresBtn?.className).toContain("active");
    fireEvent.click(screen.getByText("Tips & Practices"));
    expect(featuresBtn?.className).not.toContain("active");
  });
});
