// =============================================================================
// website-app/src/features/demoCatalog.ts
// Feature demo metadata, category grouping, slug resolution, and aliases.
// =============================================================================

export type FeatureDemoCategory =
  | 'Workspace'
  | 'Reader & Data'
  | 'Authoring'
  | 'Audit & Git'
  | 'Productivity'
  | 'Personalization';

export type FeatureDemoSlug =
  | 'workspace-home'
  | 'sidebar-toc'
  | 'workspace'
  | 'tables-charts'
  | 'live-editor'
  | 'split-view'
  | 'insights'
  | 'git-diff'
  | 'search-bookmarks'
  | 'export-center'
  | 'themes-tabs';

export interface FeatureDemoItem {
  readonly slug: FeatureDemoSlug;
  readonly category: FeatureDemoCategory;
  readonly title: string;
  readonly badge: string;
  readonly subtitle: string;
  readonly description: string;
  readonly defaultDocPath: string;
  readonly highlights: readonly string[];
}

export const FEATURE_DEMO_CATEGORIES: readonly FeatureDemoCategory[] = [
  'Workspace',
  'Reader & Data',
  'Authoring',
  'Audit & Git',
  'Productivity',
  'Personalization',
] as const;

export const DEFAULT_FEATURE_SLUG: FeatureDemoSlug = 'workspace';

export const FEATURE_DEMO_CATALOG: readonly FeatureDemoItem[] = [
  {
    slug: 'workspace-home',
    category: 'Workspace',
    title: 'Home & Welcome',
    badge: 'Home',
    subtitle: 'Recent workspaces, aliases, virtual scratchpad & onboarding',
    description:
      'Switch between pinned and recent documentation folders, launch an instant virtual workspace, or explore the Welcome Launchpad and interactive feature manual.',
    defaultDocPath: 'docs/architecture-overview.md',
    highlights: [
      'Filter, rename, and jump into recent workspaces',
      'Create a browser virtual workspace in one click',
      'Toggle between WorkspaceSelection and WelcomePage',
    ],
  },
  {
    slug: 'sidebar-toc',
    category: 'Workspace',
    title: 'Files & TOC',
    badge: 'Navigation',
    subtitle: 'Folder tree, Scope Focus filtering, History tab & active TOC',
    description:
      'Browse nested folders with pinning, quick file filter, Scope Focus multi-selection, live Table of Contents scroll spy, and Scope View modal.',
    defaultDocPath: 'docs/architecture-overview.md',
    highlights: [
      'Sidebar tabs for Files, Search, Git History, and Bookmarks',
      'Scope Focus checkboxes + ScopeViewModal multi-doc reader',
      'Live Table of Contents panel synced to scroll position',
    ],
  },
  {
    slug: 'workspace',
    category: 'Reader & Data',
    title: 'Reader & Diagrams',
    badge: 'Reader',
    subtitle: 'Mermaid lightbox, KaTeX math, frontmatter & HTML sandbox',
    description:
      'Render technical documentation offline with interactive Mermaid diagrams, KaTeX equations, YAML frontmatter properties, copyable code fences, and sandboxed HTML previews.',
    defaultDocPath: 'docs/architecture-overview.md',
    highlights: [
      'Click any Mermaid diagram to open zoom/pan MediaModal',
      'Inline + block KaTeX math and structured YAML frontmatter',
      'Toggle live HtmlDocumentView / HtmlPreviewModal sandbox',
    ],
  },
  {
    slug: 'tables-charts',
    category: 'Reader & Data',
    title: 'Tables & Charts',
    badge: 'Data',
    subtitle: 'Sort, multi-filter, CSV/TSV toggle & Chart.js visuals',
    description:
      'Turn Markdown tables and CSV/TSV code blocks into sortable, filterable grids with intelligent numeric alignment and one-click Bar, Line, or Pie charts.',
    defaultDocPath: 'docs/metrics-benchmarks.md',
    highlights: [
      'Multi-select column value filters and header sorting',
      'Toggle CSV and TSV fences between raw source and table view',
      'One-click Chart.js Bar, Line, and Pie chart generation',
    ],
  },
  {
    slug: 'live-editor',
    category: 'Authoring',
    title: 'Live Editor',
    badge: 'Editor',
    subtitle: 'CodeMirror 6 source, formatting toolbar & inline block edit',
    description:
      'Edit Markdown directly inside the reader via full CodeMirror 6 source mode with formatting toolbar, block-level InlineMarkdownEditor, or rendered preview with dirty tracking.',
    defaultDocPath: 'docs/architecture-overview.md',
    highlights: [
      'CodeMirror 6 source editor + MarkdownFormattingToolbar',
      'Click-to-edit block & table InlineMarkdownEditor',
      'Dirty-buffer indicator and in-memory Save flow',
    ],
  },
  {
    slug: 'split-view',
    category: 'Authoring',
    title: 'Split View',
    badge: 'Split',
    subtitle: 'Draggable dual-pane workspace with independent pane modes',
    description:
      'Compare two documents or edit Markdown side-by-side with live rendered output, draggable SplitDivider ratios, independent pane tabs, and one-click pane swap.',
    defaultDocPath: 'docs/architecture-overview.md',
    highlights: [
      'Independent Rendered, Inline Edit, and Plain panes',
      'Draggable SplitDivider and Swap Panes control',
      'Live preview updates as you type in CodeMirror',
    ],
  },
  {
    slug: 'insights',
    category: 'Audit & Git',
    title: 'Insights',
    badge: 'Insights',
    subtitle: 'Gallery, Links, Lint, Duplicates, Graph & Related docs',
    description:
      'Audit entire documentation folders locally: inspect broken links, heading/table lint findings, duplicate passages, media galleries, and interactive relationship graphs.',
    defaultDocPath: 'docs/architecture-overview.md',
    highlights: [
      '6 interactive audit views: Gallery, Links, Lint, Duplicates, Graph, Related',
      'Click any lint finding or broken link to jump directly to the file',
      '100% client-side indexing with zero cloud uploads',
    ],
  },
  {
    slug: 'git-diff',
    category: 'Audit & Git',
    title: 'Git & Diff',
    badge: 'Git',
    subtitle: 'DocumentDiffView, FileHistoryModal & GitCommitGraph',
    description:
      'Inspect line-by-line Myers source diffs and visual Rendered Diffs, browse per-file commit timelines in FileHistoryModal, and explore the repository commit graph.',
    defaultDocPath: 'docs/release-playbook.md',
    highlights: [
      'Source Diff & Rendered Diff comparison modes',
      'Interactive FileHistoryModal with multi-commit picking',
      'RepositoryHistoryPanel with GitCommitGraph and file trees',
    ],
  },
  {
    slug: 'search-bookmarks',
    category: 'Productivity',
    title: 'Search & Bookmarks',
    badge: 'Search',
    subtitle: 'SearchOverlay with live preview & BookmarksPanel anchors',
    description:
      'Search across workspace documents with highlighted excerpts and live document preview, and organize reusable text bookmarks with search, sort, and rename.',
    defaultDocPath: 'docs/architecture-overview.md',
    highlights: [
      'SearchOverlay with case matching and live Markdown preview',
      'BookmarksPanel with seeded anchors, sorting, and filtering',
      'Jump directly from any search hit or bookmark to its file',
    ],
  },
  {
    slug: 'export-center',
    category: 'Productivity',
    title: 'Export & Scope',
    badge: 'Export',
    subtitle: 'ExportCenterModal (HTML/PDF/ZIP) & ScopeViewModal',
    description:
      'Bundle single documents, folders, or entire workspaces into self-contained HTML files or static-site ZIP archives offline, or read focused selections in ScopeViewModal.',
    defaultDocPath: 'docs/architecture-overview.md',
    highlights: [
      'Export Current File, Selected Files, Folder, or Workspace',
      'Standalone HTML and static-site ZIP bundle output',
      'ScopeViewModal distraction-free scoped document reader',
    ],
  },
  {
    slug: 'themes-tabs',
    category: 'Personalization',
    title: 'Tabs & Themes',
    badge: 'Themes',
    subtitle: 'DesktopTabBar, 9 themes, SettingsModal, ThemeRemix & Tour',
    description:
      'Manage multi-workspace tabs in DesktopTabBar, switch across all 9 built-in & Pet themes, customize typography and shortcuts in SettingsModal, or launch the guided Tour.',
    defaultDocPath: 'docs/design-system-themes.md',
    highlights: [
      'Stateful DesktopTabBar (add, close, reorder, rename alias)',
      'All 9 themes including Cyberpunk, Tokyo Night & Pet themes',
      'Real SettingsModal, ThemeRemixModal, and TourGuideOverlay',
    ],
  },
];

const SLUG_SET = new Set<string>(FEATURE_DEMO_CATALOG.map((item) => item.slug));

const SLUG_ALIASES: Readonly<Record<string, FeatureDemoSlug>> = {
  'home': 'workspace-home',
  'launchpad': 'workspace-home',
  'workspace-home': 'workspace-home',
  'toc-sidebar': 'sidebar-toc',
  'sidebar-toc': 'sidebar-toc',
  'read': 'sidebar-toc',
  'markdown-rendering': 'workspace',
  'workspace': 'workspace',
  'charts': 'tables-charts',
  'data': 'tables-charts',
  'tables-charts': 'tables-charts',
  'editor': 'live-editor',
  'live-editor': 'live-editor',
  'split': 'split-view',
  'split-editor': 'split-view',
  'split-view': 'split-view',
  'insights': 'insights',
  'insights-export': 'insights',
  'search': 'insights',
  'split-git': 'git-diff',
  'git-diff': 'git-diff',
  'write': 'git-diff',
  'bookmarks': 'search-bookmarks',
  'search-bookmarks': 'search-bookmarks',
  'export': 'export-center',
  'export-center': 'export-center',
  'search-bookmarks-export': 'export-center',
  'themes': 'themes-tabs',
  'settings': 'themes-tabs',
  'themes-tabs': 'themes-tabs',
};

export function resolveFeatureSlug(raw: string | null | undefined): FeatureDemoSlug {
  if (!raw) return DEFAULT_FEATURE_SLUG;
  const normalized = raw.trim().replace(/^#/, '').toLowerCase();
  if (SLUG_ALIASES[normalized]) return SLUG_ALIASES[normalized];
  if (SLUG_SET.has(normalized)) return normalized as FeatureDemoSlug;
  return DEFAULT_FEATURE_SLUG;
}

export function getFeatureDemoItem(slug: FeatureDemoSlug): FeatureDemoItem {
  return (
    FEATURE_DEMO_CATALOG.find((item) => item.slug === slug) ??
    FEATURE_DEMO_CATALOG[0]
  );
}
