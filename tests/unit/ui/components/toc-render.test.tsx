import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TableOfContents } from '../../../../ui/src/components/TOC/TableOfContents';

let mockState: any;
let contentScrollEl: HTMLDivElement;

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mockState }),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    toc: { onThisPage: 'On This Page', returnToTop: 'Return to top', sections: 'Sections' },
  }),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  ChevronUpIcon: ({ size, className }: any) => <span className={className}>chevron-up-icon</span>,
}));

describe('TableOfContents', () => {
  beforeEach(() => {
    mockState = {
      toc: [
        { level: 1, text: 'Introduction', id: 'introduction' },
        { level: 2, text: 'Getting Started', id: 'getting-started' },
        { level: 3, text: 'Installation', id: 'installation' },
        { level: 2, text: 'Configuration', id: 'configuration' },
      ],
      settings: { language: 'en' },
      currentFile: '/docs/readme.md',
      renderVersion: 1,
      tocCollapsed: false,
    };
    contentScrollEl = document.createElement('div');
    contentScrollEl.id = 'contentScroll';
    document.body.appendChild(contentScrollEl);
  });

  afterEach(() => {
    document.body.removeChild(contentScrollEl);
  });

  it('returns null when toc is empty', () => {
    mockState.toc = [];
    const { container } = render(<TableOfContents />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when toc items exist (panel variant)', () => {
    render(<TableOfContents />);
    expect(screen.getByLabelText('Table of contents')).toBeInTheDocument();
  });

  it('renders On This Page header', () => {
    render(<TableOfContents />);
    expect(screen.getByText('On This Page')).toBeInTheDocument();
  });

  it('renders toc item count', () => {
    render(<TableOfContents />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders all toc items as buttons', () => {
    render(<TableOfContents />);
    const tocItems = document.querySelectorAll('.toc-item__text');
    expect(tocItems).toHaveLength(4);
    expect(tocItems[0]).toHaveTextContent('Introduction');
    expect(tocItems[1]).toHaveTextContent('Getting Started');
    expect(tocItems[2]).toHaveTextContent('Installation');
    expect(tocItems[3]).toHaveTextContent('Configuration');
  });

  it('renders marker hooks with a default active dot', () => {
    render(<TableOfContents />);

    expect(document.querySelectorAll('.toc-item__marker')).toHaveLength(4);
    const styles = readFileSync(
      resolve(process.cwd(), 'ui/src/styles/global/global-toc-panel.css'),
      'utf8',
    );
    expect(styles).toMatch(
      /\.toc-item\.is-active \.toc-item__marker\s*\{[^}]*display: block;[^}]*background: var\(--accent\);/s,
    );
    expect(styles).toMatch(
      /\.toc-item\.is-active \.toc-item__marker\s*\{[^}]*margin-right: 4px;/s,
    );
  });

  it('renders toc items with correct heading level class', () => {
    render(<TableOfContents />);
    const h1Items = document.querySelectorAll('.toc-item--h1');
    const h2Items = document.querySelectorAll('.toc-item--h2');
    const h3Items = document.querySelectorAll('.toc-item--h3');
    expect(h1Items).toHaveLength(1);
    expect(h2Items).toHaveLength(2);
    expect(h3Items).toHaveLength(1);
  });

  it('calls scrollIntoView on toc item click', () => {
    const mockScrollIntoView = vi.fn();
    const mockEl = { scrollIntoView: mockScrollIntoView, closest: () => null } as any;
    const getByIdSpy = vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      if (id === 'getting-started') return mockEl;
      return document.createElement('div');
    });
    render(<TableOfContents />);
    const h2Item = document.querySelector('.toc-item--h2') as HTMLElement;
    fireEvent.click(h2Item);
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    getByIdSpy.mockRestore();
  });

  it('expands parent sections on click', () => {
    const mockScrollIntoView = vi.fn();
    const mockParent = { dataset: {} } as any;
    const mockEl = { scrollIntoView: mockScrollIntoView, closest: () => mockParent } as any;
    mockParent.closest = () => null;
    mockParent.parentElement = { closest: () => null };
    const getByIdSpy = vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      if (id === 'getting-started') return mockEl;
      return contentScrollEl;
    });
    render(<TableOfContents />);
    const h2Item = document.querySelector('.toc-item--h2') as HTMLElement;
    fireEvent.click(h2Item);
    expect(mockParent.dataset.expanded).toBe('true');
    getByIdSpy.mockRestore();
  });

  it('does nothing when element not found on click', () => {
    const getByIdSpy = vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      if (id === 'contentScroll') return contentScrollEl;
      return null;
    });
    render(<TableOfContents />);
    const h2Item = document.querySelector('.toc-item--h2') as HTMLElement;
    fireEvent.click(h2Item);
    getByIdSpy.mockRestore();
  });

  it('renders is-collapsed class when tocCollapsed is true', () => {
    mockState.tocCollapsed = true;
    render(<TableOfContents />);
    const panel = document.getElementById('tocPanel');
    expect(panel!.className).toContain('is-collapsed');
  });

  it('does not render is-collapsed class when tocCollapsed is false', () => {
    mockState.tocCollapsed = false;
    render(<TableOfContents />);
    const panel = document.getElementById('tocPanel');
    expect(panel!.className).not.toContain('is-collapsed');
  });

  it('renders the current active entry text', () => {
    render(<TableOfContents />);
    const current = document.querySelector('.toc-panel__current');
    expect(current).toHaveTextContent('Introduction');
  });

  describe('compact variant', () => {
    it('renders compact nav when variant is compact', () => {
      render(<TableOfContents variant="compact" />);
      const nav = document.querySelector('.toc-compact');
      expect(nav).toBeInTheDocument();
    });

    it('renders toggle button with On This Page label', () => {
      render(<TableOfContents variant="compact" />);
      expect(screen.getByText('On This Page')).toBeInTheDocument();
    });

    it('does not define a decorative left rail for the compact toggle', () => {
      const styles = readFileSync(
        resolve(process.cwd(), 'ui/src/styles/global/global-toc-panel.css'),
        'utf8',
      );

      expect(styles).toMatch(/\.toc-compact__toggle::before\s*\{\s*display: none;/);
    });

    it('removes active TOC and refresh-banner rails while retaining pet paw hooks', () => {
      const themeStyles = [
        'ui/src/styles/global/global-theme-vercel.css',
        'ui/src/styles/global/global-theme-tokyo-night.css',
        'ui/src/styles/global/global-theme-glass-bento.css',
        'ui/src/styles/global/global-pet-theme-backgrounds.css',
      ].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');
      const markdownStyles = [
        'ui/src/styles/global/global-markdown-foundation.css',
        'ui/src/styles/global/global-markdown-structures.css',
      ].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');

      expect(themeStyles).not.toMatch(/\.toc-item\.is-active[^}]*box-shadow/);
      expect(markdownStyles).not.toContain('border-left-color: color-mix(in srgb, var(--accent) 72%');
      expect(themeStyles).toContain('.tree-file.is-active::before');
      expect(themeStyles).toContain('.toc-item.is-active .toc-item__marker');
      expect(themeStyles).toMatch(
        /\.toc-compact__toggle::before\s*\{[^}]*display: block;[^}]*background: var\(--pet-paw\)/s,
      );
      expect(themeStyles).toMatch(
        /\.toc-item\.is-active \.toc-item__marker\s*\{\s*display: block;\s*width: 16px;\s*height: 16px;\s*margin-top: 1px;\s*margin-right: 0;\s*flex: 0 0 16px;/s,
      );
    });

    it('removes preview-notice and pet heading rails', () => {
      const markdownStyles = [
        'ui/src/styles/global/global-markdown-foundation.css',
        'ui/src/styles/global/global-markdown-structures.css',
      ].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');
      const petStyles = readFileSync(
        resolve(process.cwd(), 'ui/src/styles/global/global-pet-theme-backgrounds.css'),
        'utf8',
      );

      expect(markdownStyles).not.toMatch(
        /\.document-preview-notice\s*\{[^}]*border-left\s*:/s,
      );
      expect(markdownStyles).not.toContain('border-left-color: var(--tx2);');
      expect(petStyles).not.toMatch(
        /\.mdn-section--h1\s*>\s*\.mdn-section-header\s*\{[^}]*box-shadow\s*:/s,
      );
    });

    it('defines a right-side square heading badge that appears on heading hover or focus', () => {
      const sectionStyles = [
        'ui/src/styles/global/global-markdown-foundation.css',
        'ui/src/styles/global/global-markdown-structures.css',
      ].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');

      expect(sectionStyles).toMatch(
        /\.mdn-heading-level\s*\{[^}]*left:\s*calc\(100% \+ 8px\);[^}]*aspect-ratio:\s*1;[^}]*border:[^}]*visibility:\s*hidden;/s,
      );
      expect(sectionStyles).toMatch(
        /\.mdn-section-header:hover \.mdn-heading-level,[\s\S]*\.mdn-section-header:focus-within \.mdn-heading-level\s*\{[^}]*visibility:\s*visible;[^}]*opacity:\s*1;/s,
      );
    });

    it('removes sidebar file rails while keeping pet paw hooks', () => {
      const sidebarStyles = [
        'ui/src/styles/global/global-layout-sidebar.css',
        'ui/src/styles/global/global-theme-vercel.css',
        'ui/src/styles/global/global-theme-tokyo-night.css',
        'ui/src/styles/global/global-theme-glass-bento.css',
        'ui/src/styles/global/global-pet-theme-backgrounds.css',
      ].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');

      expect(sidebarStyles).not.toMatch(/\.tree-file\.is-active[^}]*box-shadow\s*:/s);
      expect(sidebarStyles).not.toMatch(/\.tree-file\.is-cursor\s*\{[^}]*box-shadow\s*:/s);
      expect(sidebarStyles).toContain('.tree-file.is-active::before');
    });

    it('toggles compact menu on click', () => {
      render(<TableOfContents variant="compact" />);
      const toggle = screen.getByText('On This Page').closest('button')!;
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('renders Return to top button when open', () => {
      render(<TableOfContents variant="compact" />);
      const toggle = screen.getByText('On This Page').closest('button')!;
      fireEvent.click(toggle);
      expect(screen.getByText('Return to top')).toBeInTheDocument();
    });

    it('closes compact menu on item click', () => {
      const mockScrollIntoView = vi.fn();
      const getByIdSpy = vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        if (id === 'introduction') return { scrollIntoView: mockScrollIntoView, closest: () => null } as any;
        return contentScrollEl;
      });
      render(<TableOfContents variant="compact" />);
      const toggle = screen.getByText('On This Page').closest('button')!;
      fireEvent.click(toggle);
      const textItems = document.querySelectorAll('.toc-compact__menu .toc-item__text');
      fireEvent.click(textItems[0]);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      getByIdSpy.mockRestore();
    });

    it('scrolls to top on Return to top click', () => {
      const mockScrollTo = vi.fn();
      const orig = document.getElementById;
      vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        if (id === 'contentScroll') {
          contentScrollEl.scrollTo = mockScrollTo;
          return contentScrollEl;
        }
        return null;
      });
      render(<TableOfContents variant="compact" />);
      const toggle = screen.getByText('On This Page').closest('button')!;
      fireEvent.click(toggle);
      fireEvent.click(screen.getByText('Return to top'));
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      vi.restoreAllMocks();
    });
  });
});
