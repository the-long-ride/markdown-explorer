import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WebDemoNavActions,
  resolveWebsitePageUrl,
} from '../../../../ui/src/components/Topbar/WebDemoNavActions';

vi.mock('../../../../ui/src/hooks/useGitHubStars', () => ({
  useGitHubStars: vi.fn(() => 42),
}));

describe('resolveWebsitePageUrl', () => {
  it('resolves relative to parent when in /app/ directory', () => {
    expect(resolveWebsitePageUrl('landing.html#download', '/app/')).toBe('../landing.html#download');
    expect(resolveWebsitePageUrl('landing.html#features', '/app/index.html')).toBe('../landing.html#features');
    expect(resolveWebsitePageUrl('privacy.html', '/markdown-explorer/app/')).toBe('../privacy.html');
    expect(resolveWebsitePageUrl('terms.html', '/prefix/app/index.html')).toBe('../terms.html');
  });

  it('resolves with ./ when in website root or outside /app/', () => {
    expect(resolveWebsitePageUrl('landing.html#download', '/')).toBe('./landing.html#download');
    expect(resolveWebsitePageUrl('landing.html#download', '/index.html')).toBe('./landing.html#download');
    expect(resolveWebsitePageUrl('privacy.html', '/landing.html')).toBe('./privacy.html');
  });
});

describe('WebDemoNavActions', () => {
  const originalLocation = window.location;
  let mockLocation: { href: string; search: string; pathname: string; assign: any };

  beforeEach(() => {
    mockLocation = {
      href: 'http://localhost/app/?mode=web',
      search: '?mode=web',
      pathname: '/app/',
      assign: vi.fn(),
    };
    delete (window as any).location;
    window.location = mockLocation as any;
    delete window.__webBus;
  });

  afterEach(() => {
    delete window.__webBus;
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  it('renders nothing when not in website demo runtime', () => {
    delete window.__webBus;
    const { container } = render(<WebDemoNavActions />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('web-demo-nav')).toBeNull();
  });

  it('renders all 6 navigation actions when in website demo runtime', () => {
    window.__webBus = new EventTarget();
    render(<WebDemoNavActions />);

    expect(screen.getByTestId('web-demo-nav')).not.toBeNull();
    const actionIds = [
      'web-demo-nav-mode',
      'web-demo-nav-download',
      'web-demo-nav-features',
      'web-demo-nav-github',
      'web-demo-nav-privacy',
      'web-demo-nav-terms',
    ];
    for (const id of actionIds) {
      const btn = screen.getByTestId(id);
      expect(btn).not.toBeNull();
      expect(btn).toHaveClass('btn--icon');
      expect(btn.querySelector('.btn-label')).toBeNull();
      expect(btn.querySelector('svg')).not.toBeNull();
    }
    const badge = screen.getByTestId('web-demo-nav-github').querySelector('.web-demo-nav__stars-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('★ 42');
  });

  it('toggles mode between web and test when mode button is clicked', () => {
    window.__webBus = new EventTarget();
    mockLocation.search = '?mode=web';

    const { rerender } = render(<WebDemoNavActions />);
    const modeBtn = screen.getByTestId('web-demo-nav-mode');
    expect(modeBtn.textContent).toContain('Mode Test');

    fireEvent.click(modeBtn);
    expect(window.location.href).toBe('?mode=test');

    // In test mode:
    mockLocation.search = '?mode=test';
    rerender(<WebDemoNavActions />);
    const modeBtnAfter = screen.getByTestId('web-demo-nav-mode');
    expect(modeBtnAfter.textContent).toContain('Markdown Explorer on Web');
    expect(modeBtnAfter.querySelector('svg circle')).not.toBeNull();

    fireEvent.click(modeBtnAfter);
    expect(window.location.href).toBe('?mode=web');
  });

  it('navigates to download and features page', () => {
    window.__webBus = new EventTarget();
    render(<WebDemoNavActions />);

    fireEvent.click(screen.getByTestId('web-demo-nav-download'));
    expect(window.location.href).toBe('../landing.html#download');

    fireEvent.click(screen.getByTestId('web-demo-nav-features'));
    expect(window.location.href).toBe('../features/');
  });

  it('navigates to privacy and terms page', () => {
    window.__webBus = new EventTarget();
    render(<WebDemoNavActions />);

    fireEvent.click(screen.getByTestId('web-demo-nav-privacy'));
    expect(window.location.href).toBe('../privacy.html');

    fireEvent.click(screen.getByTestId('web-demo-nav-terms'));
    expect(window.location.href).toBe('../terms.html');
  });

  it('renders github button with stars count and opens github repository in new tab', () => {
    window.__webBus = new EventTarget();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<WebDemoNavActions />);

    const githubBtn = screen.getByTestId('web-demo-nav-github');
    expect(githubBtn.textContent).toContain('GitHub');
    expect(githubBtn.textContent).toContain('★ 42');

    fireEvent.click(githubBtn);
    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/the-long-ride/markdown-explorer',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
