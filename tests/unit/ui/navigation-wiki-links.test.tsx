import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  NavigationProvider,
  useNavigation,
  type WikiNavigationResolver,
} from '../../../ui/src/contexts/NavigationContext';
import { handleWikiLinkClick } from '../../../ui/src/dom/globalHandlers';

const mockNavigate = vi.fn();
vi.mock('../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ navigate: mockNavigate }),
}));

describe('wiki navigation', () => {
  it('resolves raw wiki targets before navigating to canonical paths', async () => {
    mockNavigate.mockClear();
    const resolver: WikiNavigationResolver = {
      resolve: vi.fn(async (rawTarget, sourceDocumentPath) => {
        expect(rawTarget).toBe('Guide#Install');
        expect(sourceDocumentPath).toBe('docs/Start.md');
        return {
          status: 'resolved',
          documentPath: 'docs/Guide.md',
          canonicalPath: 'docs/Guide.md',
          fragment: 'install',
          caseMismatch: false,
        };
      }),
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NavigationProvider wikiResolver={resolver}>{children}</NavigationProvider>
    );
    const { result } = renderHook(() => useNavigation(), { wrapper });

    await act(async () => {
      await result.current.navigateWikiLink('Guide#Install', 'docs/Start.md');
    });

    expect(mockNavigate).toHaveBeenCalledWith('docs/Guide.md');
  });

  it('does not navigate unresolved or ambiguous wiki targets', async () => {
    mockNavigate.mockClear();
    const resolver: WikiNavigationResolver = {
      resolve: vi.fn(async () => ({ status: 'ambiguous', candidates: ['A.md', 'B.md'] })),
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NavigationProvider wikiResolver={resolver}>{children}</NavigationProvider>
    );
    const { result } = renderHook(() => useNavigation(), { wrapper });
    await act(async () => {
      await result.current.navigateWikiLink('Guide', 'docs/Start.md');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('delegates rendered wiki-link clicks as raw target/source navigation requests', () => {
    document.body.innerHTML = '<a class="mdn-wiki-link" data-mdn-wiki-target="Guide" data-mdn-wiki-fragment="Install" data-mdn-source-document-path="docs/Start.md">Guide</a>';
    const anchor = document.querySelector('a')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: anchor });
    const navigate = vi.fn();

    expect(handleWikiLinkClick(event, navigate)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith('Guide#Install', 'docs/Start.md');
  });
});
