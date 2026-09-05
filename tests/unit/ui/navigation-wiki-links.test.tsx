import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NavigationProvider,
  useNavigation,
  type WikiResolver,
} from '../../../ui/src/contexts/NavigationContext';

const mockNavigate = vi.fn();

vi.mock('../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    navigate: mockNavigate,
  }),
}));

describe('NavigationContext wiki links', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('exposes resolver-backed wiki navigation without changing path navigation', async () => {
    const resolver: WikiResolver = {
      resolve: vi.fn(async (rawTarget, sourceDocumentPath) => ({
        status: rawTarget === 'Ambiguous'
          ? 'ambiguous'
          : rawTarget === 'Missing'
            ? 'missing'
            : 'resolved',
        canonicalPath: rawTarget === 'Resolved' ? 'docs/Resolved.md' : undefined,
        fragment: rawTarget === 'Resolved' ? 'install' : '',
        candidates: rawTarget === 'Ambiguous'
          ? ['docs/Ambiguous.md', 'notes/Ambiguous.md']
          : undefined,
        sourceDocumentPath,
      })),
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NavigationProvider wikiResolver={resolver}>{children}</NavigationProvider>
    );
    const { result } = renderHook(() => useNavigation(), { wrapper });

    let ambiguous: Awaited<ReturnType<typeof result.current.navigateWikiLink>> | undefined;
    await act(async () => {
      ambiguous = await result.current.navigateWikiLink('Ambiguous', 'docs/Start.md');
    });
    expect(ambiguous?.status).toBe('ambiguous');
    expect(mockNavigate).not.toHaveBeenCalled();

    let missing: Awaited<ReturnType<typeof result.current.navigateWikiLink>> | undefined;
    await act(async () => {
      missing = await result.current.navigateWikiLink('Missing', 'docs/Start.md');
    });
    expect(missing?.status).toBe('missing');
    expect(mockNavigate).not.toHaveBeenCalled();

    let resolved: Awaited<ReturnType<typeof result.current.navigateWikiLink>> | undefined;
    await act(async () => {
      resolved = await result.current.navigateWikiLink('Resolved', 'docs/Start.md');
    });
    expect(resolved).toMatchObject({
      status: 'resolved',
      canonicalPath: 'docs/Resolved.md',
      fragment: 'install',
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('falls back to a missing result when no resolver is provided', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NavigationProvider>{children}</NavigationProvider>
    );
    const { result } = renderHook(() => useNavigation(), { wrapper });

    let resolution: Awaited<ReturnType<typeof result.current.navigateWikiLink>> | undefined;
    await act(async () => {
      resolution = await result.current.navigateWikiLink('Anything', 'docs/Start.md');
    });

    expect(resolution).toEqual({ status: 'missing' });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('reveals a resolved wiki fragment after the destination document renders', async () => {
    document.body.innerHTML = '<div id="mdBody" data-mdn-source-document-path="docs/Start.md"></div>';
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const resolver: WikiResolver = {
      resolve: vi.fn(async () => ({
        status: 'resolved',
        canonicalPath: 'docs/Guide.md',
        fragment: 'install',
      })),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NavigationProvider wikiResolver={resolver}>{children}</NavigationProvider>
    );
    const { result } = renderHook(() => useNavigation(), { wrapper });

    await act(async () => {
      await result.current.navigateWikiLink('Guide#Install', 'docs/Start.md');
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    const body = document.createElement('div');
    body.id = 'mdBody';
    body.dataset.mdnSourceDocumentPath = 'docs/Guide.md';
    const section = document.createElement('section');
    section.className = 'mdn-section';
    section.dataset.expanded = 'false';
    const heading = document.createElement('h2');
    heading.id = 'install';
    section.append(heading);
    body.append(section);
    document.body.replaceChildren(body);

    await vi.waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
      expect(section.dataset.expanded).toBe('true');
    });
  });

  it('reveals same-document fragments without reopening the current file', async () => {
    document.body.innerHTML = `
      <div id="mdBody" data-mdn-source-document-path="docs/Guide.md">
        <section class="mdn-section" data-expanded="false">
          <h2 id="install">Install</h2>
        </section>
      </div>
    `;
    const heading = document.getElementById('install') as HTMLElement;
    const section = heading.closest('.mdn-section') as HTMLElement;
    const scrollIntoView = vi.fn();
    Object.defineProperty(heading, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const resolver: WikiResolver = {
      resolve: vi.fn(async () => ({
        status: 'resolved',
        canonicalPath: 'docs/Guide.md',
        fragment: 'install',
      })),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NavigationProvider wikiResolver={resolver}>{children}</NavigationProvider>
    );
    const { result } = renderHook(() => useNavigation(), { wrapper });

    await act(async () => {
      await result.current.navigateWikiLink('#Install', 'docs/Guide.md');
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(section.dataset.expanded).toBe('true');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale resolver completion superseded by a newer wiki navigation', async () => {
    type Resolution = Awaited<ReturnType<WikiResolver['resolve']>>;
    let resolveFirst!: (resolution: Resolution) => void;
    const firstResolution = new Promise<Resolution>((resolve) => {
      resolveFirst = resolve;
    });

    const resolver: WikiResolver = {
      resolve: vi.fn((rawTarget) => rawTarget === 'First'
        ? firstResolution
        : Promise.resolve({
            status: 'resolved',
            canonicalPath: 'docs/Second.md',
            fragment: '',
          })),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NavigationProvider wikiResolver={resolver}>{children}</NavigationProvider>
    );
    const { result } = renderHook(() => useNavigation(), { wrapper });

    let firstNavigation!: Promise<Resolution>;
    act(() => {
      firstNavigation = result.current.navigateWikiLink('First', 'docs/Start.md');
    });

    await act(async () => {
      await result.current.navigateWikiLink('Second', 'docs/Start.md');
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenLastCalledWith(expect.stringContaining('docs/Second.md'));

    await act(async () => {
      resolveFirst({
        status: 'resolved',
        canonicalPath: 'docs/First.md',
        fragment: '',
      });
      await firstNavigation;
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
