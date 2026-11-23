import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { useDocumentOverlays } from '../../../../ui/src/components/Content/useDocumentOverlays';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import { copyElementImageToClipboard, saveElementImageAsPng } from '../../../../ui/src/dom/copyImage';
import { ACTION_NOTICE_EVENT } from '../../../../ui/src/utils/actionNotice';
import type { LinkContextMenuState } from '../../../../ui/src/components/shared/LinkContextMenu';

vi.mock('../../../../ui/src/components/Modal/ScopeViewModal', () => ({ ScopeViewModal: () => null }));
vi.mock('../../../../ui/src/components/Bookmarks/BookmarkSelectionMenu', () => ({ BookmarkSelectionMenu: () => null }));
vi.mock('../../../../ui/src/dom/copyImage', () => ({ copyElementImageToClipboard: vi.fn(), saveElementImageAsPng: vi.fn() }));

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

  const copy = getTranslations('en').previewActions;

  it('uses the external browser for web links and the standalone document preview for page fragments', () => {
    const bridge = { postMessage: vi.fn() };
    let open: (menu: LinkContextMenuState) => void;
    render(<Harness bridge={bridge} onReady={(fn) => { open = fn; }} />);
    const url = 'https://example.test/reference';
    act(() => open({ x: 10, y: 10, link: { kind: 'web', raw: url, resolved: url, openable: true, copyable: true } }));
    fireEvent.click(screen.getByRole('menuitem', { name: copy.openInBrowser }));
    expect(bridge.postMessage).toHaveBeenLastCalledWith({ command: 'openExternal', url });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    act(() => open({ x: 10, y: 10, link: { kind: 'fragment', raw: '#heading', resolved: 'file:///docs/b.md#heading', openable: true, copyable: true } }));
    fireEvent.click(screen.getByRole('menuitem', { name: copy.openInBrowser }));
    expect(bridge.postMessage).toHaveBeenLastCalledWith({
      command: 'openHtmlPreview',
      documentHtml: expect.stringContaining('<p>b</p>'),
    });
    expect(bridge.postMessage.mock.lastCall?.[0].documentHtml).toContain('heading');
  });

  it('reports a failed copy, leaves the link available, and reports success on retry', async () => {
    const bridge = { postMessage: vi.fn(), copyToClipboard: vi.fn().mockRejectedValueOnce(new Error('Clipboard unavailable')).mockResolvedValueOnce(undefined) };
    const notice = vi.fn();
    window.addEventListener(ACTION_NOTICE_EVENT, notice);
    try {
      let open: (menu: LinkContextMenuState) => void;
      render(<Harness bridge={bridge} onReady={(fn) => { open = fn; }} />);
      const url = 'https://example.test/reference';
      act(() => open({ x: 10, y: 10, link: { kind: 'web', raw: url, resolved: url, openable: true, copyable: true } }));
      const action = screen.getByRole('menuitem', { name: copy.copyLink });
      fireEvent.click(action);
      await waitFor(() => expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { message: copy.copyFailed, tone: 'neutral' } })));
      expect(action).toBeInTheDocument();
      fireEvent.click(action);
      await waitFor(() => expect(action).not.toBeInTheDocument());
      expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { message: copy.linkCopied, tone: 'neutral' } }));
    } finally {
      window.removeEventListener(ACTION_NOTICE_EVENT, notice);
    }
  });

  it.each([
    ['image', true, 'diagram.png'],
    ['mermaid', false, 'mermaid-diagram.png'],
    ['image', new Error('Image inaccessible'), 'diagram.png'],
  ] as const)('reports the result of copying or saving a %s with result %j', async (kind, result, expectedName) => {
    const notice = vi.fn();
    window.addEventListener(ACTION_NOTICE_EVENT, notice);
    try {
      const copyImage = vi.mocked(copyElementImageToClipboard);
      const saveImage = vi.mocked(saveElementImageAsPng);
      if (result instanceof Error) {
        copyImage.mockRejectedValueOnce(result);
        saveImage.mockRejectedValueOnce(result);
      } else {
        copyImage.mockResolvedValueOnce(result);
        saveImage.mockResolvedValueOnce(result);
      }
      let open: (menu: LinkContextMenuState) => void;
      render(<Harness bridge={{}} onReady={(fn) => { open = fn; }} />);
      const image = document.createElement('img');
      if (kind === 'mermaid') image.setAttribute('data-mdn-bookmark-kind', kind);
      act(() => open({ x: 10, y: 10, imageTarget: image }));
      fireEvent.click(screen.getByRole('menuitem', { name: copy.copyImage }));
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(copyImage).toHaveBeenLastCalledWith(image);
      expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({
        detail: { message: result === true ? copy.imageCopied : copy.copyFailed, tone: 'neutral' },
      }));

      act(() => open({ x: 10, y: 10, imageTarget: image }));
      fireEvent.click(screen.getByRole('menuitem', { name: copy.saveImagePng }));
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(saveImage).toHaveBeenLastCalledWith(image, expectedName);
      expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({
        detail: { message: result === true ? copy.imageSaved : copy.imageSaveFailed, tone: result === true ? 'neutral' : 'error' },
      }));
    } finally {
      window.removeEventListener(ACTION_NOTICE_EVENT, notice);
    }
  });
});
