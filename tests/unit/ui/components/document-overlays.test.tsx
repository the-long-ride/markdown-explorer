import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { initialState, type AppState } from '../../../../ui/src/contexts/appStateModel';
import { useDocumentOverlays } from '../../../../ui/src/components/Content/useDocumentOverlays';
import { getExportScopeTranslations } from '../../../../ui/src/contexts/exportScopeTranslations';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import { copyElementImageToClipboard, saveElementImageAsPng } from '../../../../ui/src/dom/copyImage';
import { ACTION_NOTICE_EVENT } from '../../../../ui/src/utils/actionNotice';
import type { LinkContextMenuState } from '../../../../ui/src/components/shared/LinkContextMenu';
import type { MdFile } from '../../../../ui/src/types';

vi.mock('../../../../ui/src/components/Modal/ScopeViewModal', () => ({
  ScopeViewModal: ({ initialFile }: { initialFile: MdFile | null }) => initialFile ? <div role="dialog">{initialFile.title}</div> : null,
}));
vi.mock('../../../../ui/src/components/Bookmarks/BookmarkSelectionMenu', () => ({ BookmarkSelectionMenu: () => null }));
vi.mock('../../../../ui/src/dom/copyImage', () => ({ copyElementImageToClipboard: vi.fn(), saveElementImageAsPng: vi.fn() }));

function Harness({ bridge, onReady, fileList = [], renderVersion = 1, disableScope, language = 'en' }: {
  bridge: any;
  onReady: (open: (menu: LinkContextMenuState) => void) => void;
  fileList?: AppState['fileList'];
  renderVersion?: number;
  disableScope?: boolean;
  language?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const overlays = useDocumentOverlays({
    state: { ...initialState, fileList, settings: { ...initialState.settings, language } },
    bridge,
    bodyRef,
    onImageClick: vi.fn(),
    disableScope,
    document: {
      filePath: '/docs/b.md', relativePath: 'b.md', contentHtml: '<p>b</p>', renderVersion,
      markdownSource: 'b', sourceDocumentText: null, isFullHtmlPreview: false,
    },
  });
  useEffect(() => onReady(overlays.onOpenLinkMenu), [onReady, overlays.onOpenLinkMenu]);
  return <div ref={bodyRef}>{overlays.overlays}</div>;
}

describe('useDocumentOverlays', () => {
  it('opens an indexed linked document as a scope, clears it after render changes, and hides the action when disabled', () => {
    const target: MdFile = {
      fsPath: '/docs/guide.md', relativePath: 'guide.md', parts: ['guide.md'],
      fileName: 'guide.md', title: 'Guide scope',
    };
    const bridge = { postMessage: vi.fn() };
    let open: (menu: LinkContextMenuState) => void;
    const onReady = (fn: typeof open) => { open = fn; };
    const menu: LinkContextMenuState = {
      x: 10, y: 10, link: { kind: 'relative', raw: 'guide.md', resolved: target.fsPath, openable: true, copyable: true },
    };
    const scopeLabel = getExportScopeTranslations('en').scopeView.openAsScope;
    const { rerender } = render(<Harness bridge={bridge} onReady={onReady} fileList={[target]} language="" />);
    act(() => open(menu));
    fireEvent.click(screen.getByRole('menuitem', { name: scopeLabel }));
    expect(screen.getByRole('dialog')).toHaveTextContent(target.title);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(bridge.postMessage).not.toHaveBeenCalled();
    rerender(<Harness bridge={bridge} onReady={onReady} fileList={[target]} renderVersion={2} disableScope />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => open(menu));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: scopeLabel })).not.toBeInTheDocument();
  });

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

  it('opens an absolute fragment URL through a standalone browser preview and reports bridge errors', () => {
    const notice = vi.fn();
    window.addEventListener(ACTION_NOTICE_EVENT, notice);
    try {
      const bridge = { postMessage: vi.fn(() => { throw new Error('Host unavailable'); }) };
      let open: (menu: LinkContextMenuState) => void;
      render(<Harness bridge={bridge} onReady={(fn) => { open = fn; }} />);
      const absolute = 'file:///docs/b.md#heading';
      act(() => open({ x: 10, y: 10, link: { kind: 'fragment', raw: absolute, resolved: absolute, openable: true, copyable: true } }));
      fireEvent.click(screen.getByRole('menuitem', { name: copy.openInBrowser }));
      expect(bridge.postMessage).toHaveBeenCalledWith({ command: 'openHtmlPreview', documentHtml: expect.stringContaining('heading') });
      expect(notice).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { message: copy.unableToOpenLink, tone: 'neutral' } }));
    } finally {
      window.removeEventListener(ACTION_NOTICE_EVENT, notice);
    }
  });

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
