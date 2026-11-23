import { act, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const { initWebHost, bootUi, initGlobalHandlers, loadInteractive } = vi.hoisted(() => ({
  initWebHost: vi.fn(), bootUi: vi.fn(), initGlobalHandlers: vi.fn(), loadInteractive: vi.fn(),
}));

vi.mock('../../../website-app/src/web-host', () => ({ initWebHost }));
vi.mock('../../../ui/src/main.tsx', () => { bootUi(); return {}; });
vi.mock('../../../ui/src/dom/globalHandlers', () => ({ initGlobalHandlers }));
vi.mock('../../../ui/src/components/Content/InteractiveComponents', () => { loadInteractive(); return {}; });
vi.mock('../../../website-app/src/features/FeaturesStudioApp', () => ({
  FeaturesStudioApp: () => <h1>Feature studio</h1>,
}));

afterEach(() => {
  window.history.replaceState(null, '', '/');
  document.title = '';
});

it('installs the host and title before loading the shared UI', async () => {
  vi.resetModules();
  window.history.replaceState(null, '', '/?mode=test');
  document.body.innerHTML = '<div id="root"></div>';
  await import('../../../website-app/src/main-web');
  await vi.dynamicImportSettled();
  expect(initWebHost).toHaveBeenCalledWith('test');
  expect(document.title).toBe('Markdown Explorer – Demo');
  expect(initWebHost.mock.invocationCallOrder[0]).toBeLessThan(bootUi.mock.invocationCallOrder[0]!);
});

it('defaults to web mode and does not install a host without a mount element', async () => {
  vi.resetModules();
  const { detectMode, getWebAppTitle } = await import('../../../website-app/src/main-web');
  expect(detectMode()).toBe('web');
  expect(detectMode('?mode=unsupported')).toBe('web');
  expect(getWebAppTitle('web')).toBe('Markdown Explorer – View & Edit');
  expect(initWebHost).not.toHaveBeenCalled();
});

it('mounts the feature studio, removes its splash and loads enhancements on idle', async () => {
  vi.resetModules();
  vi.useFakeTimers();
  const idle = vi.fn();
  vi.stubGlobal('requestIdleCallback', idle);
  document.body.innerHTML = '<div class="splash"></div><div id="root"></div>';
  await act(async () => { await import('../../../website-app/src/features-main'); });
  expect(initGlobalHandlers).toHaveBeenCalledOnce();
  expect(screen.getByRole('heading', { name: 'Feature studio' })).toBeVisible();
  const splash = document.querySelector('.splash');
  expect(splash).toHaveClass('fade-out');
  await vi.advanceTimersByTimeAsync(350);
  expect(splash).not.toBeInTheDocument();
  expect(loadInteractive).not.toHaveBeenCalled();
  idle.mock.calls[0][0]();
  await vi.dynamicImportSettled();
  expect(loadInteractive).toHaveBeenCalledOnce();
});

it('uses a timer to load enhancements when there is no idle callback or splash', async () => {
  vi.resetModules();
  vi.doMock('../../../ui/src/components/Content/InteractiveComponents', () => { loadInteractive(); return {}; });
  vi.useFakeTimers();
  vi.stubGlobal('requestIdleCallback', undefined);
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => { await import('../../../website-app/src/features-main'); });
  expect(loadInteractive).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(200);
  await vi.dynamicImportSettled();
  expect(loadInteractive).toHaveBeenCalledOnce();
});
