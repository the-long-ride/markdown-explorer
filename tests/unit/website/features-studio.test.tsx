import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeaturesStudioApp } from '../../../website-app/src/features/FeaturesStudioApp';
import { getFeatureDemoItem, type FeatureDemoSlug } from '../../../website-app/src/features/demoCatalog';
import { TOUR_STAGE_CHANGE_EVENT } from '../../../ui/src/components/Tour/tourEvents';

function Preview({ onImageClick }: { onImageClick: (image: HTMLElement) => void }) {
  return (
    <div data-document-root>
      <img className="mdn-img" src="/demo.png" alt="Demo illustration" onClick={(event) => onImageClick(event.currentTarget)} />
    </div>
  );
}

vi.mock('../../../ui/src/components/Content/Content', () => ({ Content: Preview }));
vi.mock('../../../ui/src/components/shared/CyberpunkMatrixBackdrop', () => ({
  CyberpunkMatrixBackdrop: () => null,
}));

function mount(query = '') {
  window.history.replaceState(null, '', `/features/${query}`);
  return render(<FeaturesStudioApp />);
}

function selectStage(slug: FeatureDemoSlug) {
  const nav = screen.getByRole('navigation', { name: 'Feature Demos' });
  const button = within(nav).getByRole('button', { name: getFeatureDemoItem(slug).title });
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-current', 'page');
  expect(window.location.search).toContain(`feature=${slug}`);
}

describe('website feature studio', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
      media, matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(),
    })));
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    Reflect.deleteProperty(window, '__webBus');
  });

  it('switches document pills, HTML preview and gallery in the workspace', async () => {
    const studio = mount();
    expect(screen.getByRole('heading', { name: 'Component Studio' })).toBeVisible();
    expect(document.body).toHaveClass('feature-studio-body');
    fireEvent.click(screen.getByRole('button', { name: 'Math & LaTeX' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Math & LaTeX' })).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(screen.getByRole('img', { name: 'Demo illustration' }));
    expect(await screen.findByRole('dialog')).toBeVisible();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'HTML Sandbox' }));
    expect(screen.getByTestId('demo-html-sandbox')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'HTML Modal' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close HTML preview' }));
    selectStage('tables-charts');
    expect(screen.getByTestId('demo-stage-tables-charts')).toBeVisible();
    expect(screen.queryByTestId('demo-html-sandbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Architecture' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Metrics & Charts' })).toHaveAttribute('aria-pressed', 'true'));
    studio.unmount();
    expect(document.body).not.toHaveClass('feature-studio-body');
  });

  it('follows location and embed parent controls without displaying the studio sidebar', async () => {
    mount('?embed=true#charts');
    expect(screen.queryByRole('navigation', { name: 'Feature Demos' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Expand/ })).toHaveAttribute('href', expect.stringContaining('tables-charts'));
    const toggle = screen.getByRole('button', { name: 'Light' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Dark' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Theme style' }));
    fireEvent.click(screen.getByRole('option', { name: 'Tokyo Night' }));
    expect(screen.getByRole('button', { name: 'Theme style' })).toHaveTextContent('Tokyo Night');
    act(() => {
      window.location.hash = '#workspace-home';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('demo-workspace-home-stage')).toBeVisible();
    act(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'mde-demo-select', feature: 'workspace' } })));
    expect(screen.getByTestId('demo-stage-workspace')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Architecture' }));
    expect(window.location.search).toBe('?embed=true');
  });

  it('switches the welcome and workspace selector subviews, including a virtual workspace reset', async () => {
    mount('?feature=workspace-home');
    const welcome = screen.getByTestId('home-subview-welcome');
    const selection = screen.getByTestId('home-subview-selection');
    fireEvent.click(welcome);
    expect(welcome).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(selection);
    expect(selection).toHaveAttribute('aria-pressed', 'true');
    act(() => window.dispatchEvent(new Event('open-homepage')));
    expect(welcome).toHaveAttribute('aria-pressed', 'true');
    act(() => window.dispatchEvent(new Event('open-workspace-selection')));
    expect(selection).toHaveAttribute('aria-pressed', 'true');
    const workspaceChanges: unknown[] = [];
    window.__webBus?.addEventListener('host-message', (event) => {
      const message = (event as CustomEvent).detail;
      if (message.command === 'workspaceFilesChanged') workspaceChanges.push(message);
    });
    fireEvent.click(screen.getByTestId('demo-trigger-virtual-workspace'));
    expect(workspaceChanges.at(-1)).toMatchObject({ workspaceName: 'virtual-scratchpad' });
    fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
    expect(workspaceChanges.at(-1)).toMatchObject({ workspaceName: 'markdown-explorer-demo' });
    selectStage('sidebar-toc');
    expect(screen.getByTestId('demo-sidebar-toc-stage')).toBeVisible();
    fireEvent.click(screen.getByTestId('open-scope-view-btn'));
    expect(await screen.findByRole('dialog')).toBeVisible();
  });

  it('enters live editor and switches to the split preview', async () => {
    mount('?feature=live-editor');
    expect(screen.getByTestId('demo-live-editor-stage')).toBeVisible();
    expect(screen.getByTestId('editor-mode-plain-btn')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('editor-mode-inline-btn'));
    expect(screen.getByTestId('editor-mode-inline-btn')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Release Playbook' }));
    expect(screen.getByRole('button', { name: 'Release Playbook' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('img', { name: 'Demo illustration' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    selectStage('split-view');
    const split = within(screen.getByTestId('demo-split-view-stage'));
    fireEvent.click(split.getByRole('button', { name: 'Secondary pane document' }));
    fireEvent.click(split.getByRole('option', { name: 'Metrics & Charts' }));
    expect(split.getByRole('button', { name: 'Secondary pane document' })).toHaveTextContent('Metrics & Charts');
    fireEvent.click(split.getByRole('button', { name: 'Swap' }));
    fireEvent.click(split.getByRole('button', { name: 'CodeMirror' }));
    fireEvent.click(split.getByRole('button', { name: 'Render' }));
    fireEvent.click(split.getByRole('button', { name: 'Sync Scroll' }));
    expect(split.getByRole('button', { name: 'Sync Scroll' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens each audit and productivity stage', async () => {
    mount('?feature=insights');
    expect(screen.getByTestId('demo-insights-stage')).toBeVisible();
    selectStage('git-diff');
    fireEvent.click(screen.getByTestId('git-submode-file-history'));
    expect(screen.getByTestId('git-submode-file-history')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('git-submode-repo-history'));
    expect(screen.getByTestId('demo-repo-history-view')).toBeVisible();
    fireEvent.click(screen.getByTestId('git-submode-diff'));
    selectStage('search-bookmarks');
    expect(screen.getByTestId('demo-search-bookmarks-stage')).toBeVisible();
    selectStage('export-center');
    expect(screen.getByTestId('demo-export-center-stage')).toBeVisible();
  });

  it('shows theme cards and opens settings and remix controls', async () => {
    mount('?feature=themes-tabs');
    const stage = screen.getByTestId('demo-themes-tabs-stage');
    expect(stage).toBeVisible();
    const cards = within(stage).getByRole('region', { name: 'Theme style cards' });
    fireEvent.click(within(cards).getByRole('button', { name: /Tokyo Night/i }));
    expect(within(cards).getByRole('button', { name: /Tokyo Night/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(stage).getByRole('button', { name: 'Settings', exact: true }));
    const settings = await screen.findByRole('dialog');
    expect(settings).toBeVisible();
    fireEvent.click(within(settings).getByRole('button', { name: /close settings/i }));
    await waitFor(() => expect(settings).not.toBeInTheDocument());
    act(() => window.dispatchEvent(new CustomEvent(TOUR_STAGE_CHANGE_EVENT, { detail: { openSettings: true } })));
    const tourSettings = await screen.findByRole('dialog');
    fireEvent.click(within(tourSettings).getByRole('button', { name: /close settings/i }));
    fireEvent.click(within(stage).getByRole('button', { name: 'Remix' }));
    const remix = await screen.findByRole('dialog');
    expect(remix).toBeVisible();
    fireEvent.click(remix);
    await waitFor(() => expect(remix).not.toBeInTheDocument());
    fireEvent.click(within(stage).getByRole('img', { name: 'Demo illustration' }));
    const gallery = await screen.findByRole('dialog');
    expect(gallery).toBeVisible();
    fireEvent.click(gallery);
  });

  it('opens search and export dialogs, then opens a file scope from export', async () => {
    mount('?feature=search-bookmarks');
    let stage = within(screen.getByTestId('demo-search-bookmarks-stage'));
    fireEvent.click(stage.getByRole('button', { name: 'Search', exact: true }));
    const search = await screen.findByRole('dialog');
    expect(within(search).getByRole('textbox')).toBeVisible();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(search).not.toBeInTheDocument();
    fireEvent.click(stage.getByRole('img', { name: 'Demo illustration' }));
    const gallery = await screen.findByRole('dialog');
    expect(gallery).toBeVisible();
    fireEvent.click(gallery);
    selectStage('export-center');
    stage = within(screen.getByTestId('demo-export-center-stage'));
    const exportDialog = await screen.findByRole('dialog', { name: /export center/i });
    fireEvent.click(exportDialog);
    expect(exportDialog).not.toBeInTheDocument();
    fireEvent.click(stage.getByRole('button', { name: 'Scope View' }));
    const scope = await screen.findByRole('dialog', { name: /scope/i });
    expect(scope).toBeVisible();
    fireEvent.click(scope);
    fireEvent.click(stage.getByRole('button', { name: 'Export Center' }));
    expect(await screen.findByRole('dialog', { name: /export center/i })).toBeVisible();
  });

  it('selects, adds, renames, and closes demo workspace tabs', async () => {
    mount('?feature=themes-tabs');
    const stage = within(screen.getByTestId('demo-themes-tabs-stage'));
    const tabs = within(stage.getByRole('tablist'));
    const metrics = tabs.getByRole('tab', { name: /benchmarks-suite/ });
    fireEvent.click(metrics);
    expect(metrics).toHaveAttribute('aria-selected', 'true');
    fireEvent.doubleClick(metrics);
    const alias = within(metrics).getByRole('textbox');
    fireEvent.change(alias, { target: { value: 'Metrics workspace' } });
    fireEvent.keyDown(alias, { key: 'Enter' });
    expect(tabs.getByRole('tab', { name: /Metrics workspace/ })).toBe(metrics);
    fireEvent.doubleClick(metrics);
    const editedAlias = within(metrics).getByRole('textbox');
    fireEvent.change(editedAlias, { target: { value: '' } });
    fireEvent.keyDown(editedAlias, { key: 'Enter' });
    expect(tabs.getByRole('tab', { name: /benchmarks-suite/ })).toBe(metrics);
    fireEvent.click(stage.getByRole('button', { name: 'New workspace tab' }));
    const newTab = tabs.getByRole('tab', { name: /architecture-docs-1/ });
    expect(newTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.contextMenu(newTab);
    fireEvent.click(screen.getByRole('menuitem', { name: /close this tab/i }));
    await waitFor(() => expect(newTab).not.toBeInTheDocument());
    expect(tabs.getByRole('tab', { selected: true })).toBeVisible();
    fireEvent.click(stage.getByRole('button', { name: 'New workspace tab' }));
    fireEvent.contextMenu(metrics);
    fireEvent.click(screen.getByRole('menuitem', { name: /close tabs to the right/i }));
    await waitFor(() => expect(tabs.getAllByRole('tab')).toHaveLength(2));
    expect(metrics).toHaveAttribute('aria-selected', 'true');
    fireEvent.contextMenu(metrics);
    fireEvent.click(screen.getByRole('menuitem', { name: /close other tabs/i }));
    await waitFor(() => expect(tabs.getAllByRole('tab')).toHaveLength(1));
    fireEvent.contextMenu(metrics);
    fireEvent.click(screen.getByRole('menuitem', { name: /close all tabs/i }));
    await waitFor(() => expect(tabs.getByRole('tab', { name: /markdown-explorer-demo/ })).toHaveAttribute('aria-selected', 'true'));
  });
});
