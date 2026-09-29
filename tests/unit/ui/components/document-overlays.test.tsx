import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { useDocumentOverlays } from '../../../../ui/src/components/Content/useDocumentOverlays';
import type { LinkContextMenuState } from '../../../../ui/src/components/shared/LinkContextMenu';

vi.mock('../../../../ui/src/components/Modal/ScopeViewModal', () => ({ ScopeViewModal: () => null }));
vi.mock('../../../../ui/src/components/Bookmarks/BookmarkSelectionMenu', () => ({ BookmarkSelectionMenu: () => null }));

function Harness({ bridge, onReady }: { bridge: any; onReady: (open: (menu: LinkContextMenuState) => void) => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const overlays = useDocumentOverlays({
    state: { ...initialState, settings: { ...initialState.settings, language: 'en' } },
    bridge,
    bodyRef,
    onImageClick: vi.fn(),
    document: {
      filePath: '/docs/b.md', relativePath: 'b.md', contentHtml: '<p>b</p>', renderVersion: 1,
      markdownSource: 'b', sourceDocumentText: null, isFullHtmlPreview: false,
    },
  });
  useEffect(() => onReady(overlays.onOpenLinkMenu), [onReady, overlays.onOpenLinkMenu]);
  return <div ref={bodyRef}>{overlays.overlays}</div>;
}

describe('useDocumentOverlays', () => {
  it('renders its own link menu and copies the resolved link', async () => {
    const bridge = { postMessage: vi.fn(), copyToClipboard: vi.fn().mockResolvedValue(undefined) };
    let open: ((menu: LinkContextMenuState) => void) | null = null;
    render(<Harness bridge={bridge} onReady={(fn) => { open = fn; }} />);

    act(() => open!({
      x: 10,
      y: 10,
      link: { kind: 'external', raw: 'https://example.test', resolved: 'https://example.test', openable: true, copyable: true } as any,
    }));

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: /copy link/i })); });
    expect(bridge.copyToClipboard).toHaveBeenCalledWith('https://example.test');
  });
});
