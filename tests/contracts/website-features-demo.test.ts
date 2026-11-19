import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { findNativeTitleViolations, findStyleViolations } from './ui-style-contract.test';

const repoRoot = path.resolve(__dirname, '../..');
const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('website interactive feature demo studio contracts', () => {
  test('wires website/features/index.html and website-app/features/index.html entrypoints', () => {
    const siteFeaturesHtml = read('website/features/index.html');
    const appFeaturesHtml = read('website-app/features/index.html');
    const viteConfig = read('website-app/vite.config.ts');
    const featuresMain = read('website-app/src/features-main.tsx');

    expect(siteFeaturesHtml).toContain('id="features-studio-iframe"');
    expect(siteFeaturesHtml).toContain('src="../app/features/"');
    expect(siteFeaturesHtml).toContain('mde-demo-select');

    expect(appFeaturesHtml).toContain('src="/src/features-main.tsx"');
    expect(viteConfig).toContain("features: resolve(__dirname, 'features/index.html')");
    expect(featuresMain).toContain('<FeaturesStudioApp />');
  });

  test('renders grouped 11-stage sidebar navigation and mounts all real UI components across stages', () => {
    const studioApp = read('website-app/src/features/FeaturesStudioApp.tsx');
    const stageRouter = read('website-app/src/features/FeatureStageRouter.tsx');
    const workspaceAndNav = read('website-app/src/features/WorkspaceAndNavStage.tsx');
    const authoring = read('website-app/src/features/AuthoringStage.tsx');
    const insightsAndDiff = read('website-app/src/features/InsightsAndDiffStage.tsx');
    const searchExport = read('website-app/src/features/SearchExportStage.tsx');
    const themesAndSettings = read('website-app/src/features/ThemesAndSettingsStage.tsx');

    expect(studioApp).toContain('data-testid="feature-demo-sidebar"');
    expect(studioApp).toContain('FEATURE_DEMO_CATALOG');
    expect(studioApp).toContain('FEATURE_DEMO_CATEGORIES');
    expect(studioApp).toContain('installDemoBusHost');
    expect(studioApp).toContain('PlatformProvider');
    expect(studioApp).toContain('AppStateProvider');
    expect(studioApp).toContain("from '../../../ui/src/components/shared/CustomSelect'");
    expect(studioApp).toContain('<CustomSelect');
    expect(studioApp).not.toMatch(/<select\b/);
    expect(authoring).not.toMatch(/<select\b/);
    expect(insightsAndDiff).not.toMatch(/<select\b/);
    expect(studioApp).toContain("'pet-k-ink'");
    expect(studioApp).toContain("'pet-white-shiba'");

    // WorkspaceAndNavStage.tsx: WorkspaceSelection, WelcomePage, Sidebar, TableOfContents, ScopeViewModal
    expect(workspaceAndNav).toContain("from '../../../ui/src/components/Workspace/WorkspaceSelection'");
    expect(workspaceAndNav).toContain("from '../../../ui/src/components/Content/WelcomePage'");
    expect(workspaceAndNav).toContain("from '../../../ui/src/components/Sidebar/Sidebar'");
    expect(workspaceAndNav).toContain("from '../../../ui/src/components/TOC/TableOfContents'");
    expect(workspaceAndNav).toContain("from '../../../ui/src/components/Modal/ScopeViewModal'");
    expect(workspaceAndNav).toContain('<WorkspaceSelection');
    expect(workspaceAndNav).toContain('<WelcomePage');
    expect(workspaceAndNav).toContain('<Sidebar');
    expect(workspaceAndNav).toContain('<TableOfContents');
    expect(workspaceAndNav).toContain('<ScopeViewModal');

    // FeatureStageRouter.tsx: Content, MediaModal, HtmlDocumentView, HtmlPreviewModal + all 11 slug routes
    expect(stageRouter).toContain("from '../../../ui/src/components/Content/Content'");
    expect(stageRouter).toContain("from '../../../ui/src/components/Modal/MediaModal'");
    expect(stageRouter).toContain("from '../../../ui/src/components/Content/HtmlDocumentView'");
    expect(stageRouter).toContain("from '../../../ui/src/components/Modal/HtmlPreviewModal'");
    expect(stageRouter).toContain('<Content');
    expect(stageRouter).toContain('<MediaModal');
    expect(stageRouter).toContain('<HtmlDocumentView');
    expect(stageRouter).toContain('<HtmlPreviewModal');
    for (const slug of [
      'workspace-home',
      'sidebar-toc',
      'live-editor',
      'split-view',
      'insights',
      'git-diff',
      'search-bookmarks',
      'export-center',
      'themes-tabs',
      'tables-charts',
    ]) {
      expect(stageRouter).toContain(`'${slug}'`);
    }

    // AuthoringStage.tsx: MarkdownEditingHeaderActions, SplitContent, Content
    expect(authoring).toContain("from '../../../ui/src/components/shared/MarkdownEditingHeaderActions'");
    expect(authoring).toContain("from '../../../ui/src/components/Content/SplitContent'");
    expect(authoring).toContain('<MarkdownEditingHeaderActions');
    expect(authoring).toContain('<SplitContent');

    // InsightsAndDiffStage.tsx: WorkspaceInsightsPanel, DocumentDiffView, FileHistoryModal, RepositoryHistoryPanel
    expect(insightsAndDiff).toContain("from '../../../ui/src/components/Insights/WorkspaceInsightsPanel'");
    expect(insightsAndDiff).toContain("from '../../../ui/src/components/History/DocumentDiffView'");
    expect(insightsAndDiff).toContain("from '../../../ui/src/components/History/FileHistoryModal'");
    expect(insightsAndDiff).toContain("from '../../../ui/src/components/History/RepositoryHistoryPanel'");
    expect(insightsAndDiff).toContain('<WorkspaceInsightsPanel');
    expect(insightsAndDiff).toContain('<DocumentDiffView');
    expect(insightsAndDiff).toContain('<FileHistoryModal');
    expect(insightsAndDiff).toContain('<RepositoryHistoryPanel');

    // SearchExportStage.tsx: SearchOverlay, BookmarksPanel, ExportCenterModal, ScopeViewModal
    expect(searchExport).toContain("from '../../../ui/src/components/Search/SearchOverlay'");
    expect(searchExport).toContain("from '../../../ui/src/components/Bookmarks/BookmarksPanel'");
    expect(searchExport).toContain("from '../../../ui/src/components/Export/ExportCenterModal'");
    expect(searchExport).toContain('<SearchOverlay');
    expect(searchExport).toContain('<BookmarksPanel');
    expect(searchExport).toContain('<ExportCenterModal');

    // ThemesAndSettingsStage.tsx: DesktopTabBar, SettingsModal, ThemeRemixModal, TourGuideOverlay
    expect(themesAndSettings).toContain("from '../../../ui/src/components/Desktop/DesktopTabBar'");
    expect(themesAndSettings).toContain("from '../../../ui/src/components/Settings/SettingsModal'");
    expect(themesAndSettings).toContain("from '../../../ui/src/components/Settings/ThemeRemixModal'");
    expect(themesAndSettings).toContain("from '../../../ui/src/components/Tour/TourGuideOverlay'");
    expect(themesAndSettings).toContain('<DesktopTabBar');
    expect(themesAndSettings).toContain('<SettingsModal');
    expect(themesAndSettings).toContain('<ThemeRemixModal');
    expect(themesAndSettings).toContain('<TourGuideOverlay');
  });

  test('enforces zero inline JSX style props and zero non-iframe title attributes in features studio', () => {
    const featureFiles = [
      path.join(repoRoot, 'website-app/src/features-main.tsx'),
      ...fs
        .readdirSync(path.join(repoRoot, 'website-app/src/features'))
        .filter((name) => /\.tsx?$/.test(name))
        .map((name) => path.join(repoRoot, 'website-app/src/features', name)),
    ];

    const styleViolations = featureFiles.flatMap(findStyleViolations);
    const titleViolations = featureFiles
      .filter((file) => file.endsWith('.tsx'))
      .flatMap(findNativeTitleViolations);

    expect(styleViolations).toEqual([]);
    expect(titleViolations).toEqual([]);
  });

  test('replaces landing.html hero & spotlight static images with live interactive iframes and YouTube placeholder', () => {
    const landingHtml = read('website/landing.html');
    const mainSection = landingHtml.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';

    expect(mainSection).not.toMatch(/<img\b/);
    expect(landingHtml).toContain('id="hero-demo-iframe"');
    expect(landingHtml).toContain('src="app/features/?embed=1&feature=workspace"');

    const spotlightIframes = landingHtml.match(/data-spotlight-iframe="/g) ?? [];
    expect(spotlightIframes).toHaveLength(4);
    for (const slug of ['sidebar-toc', 'git-diff', 'tables-charts', 'search-bookmarks']) {
      expect(landingHtml).toContain(`src="app/features/?embed=1&feature=${slug}"`);
      expect(landingHtml).toContain(`href="features/?feature=${slug}"`);
    }

    expect(landingHtml).toContain('href="features/"');
    expect(landingHtml).toContain('id="video-demo"');
    expect(landingHtml).toContain('data-youtube-placeholder');
  });

  test('removes ?landing=1 page links and exposes landing.html + features/ in sitemap.xml', () => {
    const indexHtml = read('website/index.html');
    const landingHtml = read('website/landing.html');
    const siteFeaturesHtml = read('website/features/index.html');
    const studioApp = read('website-app/src/features/FeaturesStudioApp.tsx');
    const llmTxt = read('website/llm.txt');
    const sitemap = read('website/sitemap.xml');

    expect(indexHtml).not.toContain('landing=1');
    expect(siteFeaturesHtml).not.toContain('landing=1');
    expect(studioApp).not.toContain('landing=1');
    expect(llmTxt).not.toContain('landing=1');

    expect(siteFeaturesHtml).not.toContain('features-fallback-bar');
    expect(studioApp).not.toContain('feature-highlights-bar');
    expect(siteFeaturesHtml).toContain('href="../landing.html"');
    expect(studioApp).toContain('href="/markdown-explorer/landing.html"');
    expect(landingHtml).toContain('href="features/" data-i18n="navFeatures"');
    expect(landingHtml).toContain('id="video-demo"');
    expect(landingHtml).toContain('data-youtube-placeholder');
    expect(sitemap).toContain('/markdown-explorer/landing.html');
    expect(sitemap).toContain('/markdown-explorer/features/');
  });
});
