import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bookmarkStore } from '../../../../ui/src/bookmarks/bookmarkStore';
import { BookmarkSelectionMenu, type BookmarkSelectionState } from '../../../../ui/src/components/Bookmarks/BookmarkSelectionMenu';
import { useBookmarkSelection } from '../../../../ui/src/components/Content/useBookmarkSelection';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import { ACTION_NOTICE_EVENT } from '../../../../ui/src/utils/actionNotice';

const translations = getTranslations('en').bookmarks;
const filePath = '/docs/example.md';
const source = 'Hello **world**\n\n```js\nlet x = 1;\n```';

function selectionFixture() {
  const body = document.createElement('article');
  body.innerHTML = `<p data-mdn-source-start="0" data-mdn-source-end="15">Hello <strong>world</strong></p>
    <pre data-mdn-bookmark-kind="code" data-mdn-source-start="17" data-mdn-source-end="${source.length}"><code>let x = 1;</code></pre>`;
  document.body.appendChild(body);
  return {
    enabled: true,
    currentFile: filePath as string | null,
    renderVersion: 1,
    isFullHtmlPreview: false,
    markdownSource: source as string | null,
    sourceDocumentText: null as string | null,
    bodyRef: { current: body as HTMLElement | null },
    closeLinkMenu: vi.fn(),
  };
}

function mouse(target: EventTarget, x = 0, y = 0) {
  const event = new MouseEvent('contextmenu', { clientX: x, clientY: y, cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

const state: BookmarkSelectionState = {
  x: -20, y: 10_000, documentText: 'Hello world', targetKind: 'text',
  sourceStart: 0, sourceEnd: 11, renderedText: ' Hello   world ', presentation: 'menu',
};

function menuProps(overrides: Partial<Parameters<typeof BookmarkSelectionMenu>[0]> = {}) {
  return { state, workspaceName: 'Docs', workspacePath: '/docs', filePath, translations, onClose: vi.fn(), ...overrides };
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  bookmarkStore.removeMany(bookmarkStore.getSnapshot().items.map((item) => item.id));
});

describe('bookmark target capture', () => {
  it('captures a rendered selection at fallback range coordinates and clears it on rerender', () => {
    const props = selectionFixture();
    const { result, rerender } = renderHook(useBookmarkSelection, { initialProps: props });
    const paragraph = props.bodyRef.current!.querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    Object.defineProperty(range, 'getBoundingClientRect', { value: () => new DOMRect(10, 20, 40, 10) });
    window.getSelection()!.addRange(range);
    const event = mouse(paragraph.firstChild!);
    act(() => expect(result.current.handleBookmarkContextMenu(event)).toBe(true));
    expect(event.defaultPrevented).toBe(true);
    expect(props.closeLinkMenu).toHaveBeenCalledOnce();
    expect(result.current.bookmarkSelection).toMatchObject({
      x: 30, y: 25, renderedText: 'Hello world', sourceStart: 0, sourceEnd: 15, targetKind: 'text', presentation: 'menu',
    });
    rerender({ ...props, renderVersion: 2 });
    expect(result.current.bookmarkSelection).toBeNull();
  });

  it('opens code object captures via context menu and the direct dialog action', () => {
    const props = selectionFixture();
    const body = props.bodyRef.current!;
    const code = body.querySelector('code')!;
    const outside = document.createElement('pre');
    outside.dataset.mdnBookmarkKind = 'code';
    document.body.append(outside);
    const { result } = renderHook(useBookmarkSelection, {
      initialProps: { ...props, markdownSource: null, sourceDocumentText: source },
    });
    expect(result.current.handleBookmarkContextMenu(mouse(outside))).toBe(false);
    expect(result.current.handleBookmarkContextMenu(mouse(body.querySelector('p')!))).toBe(false);
    window.getSelection()!.collapse(body, 0);
    const event = mouse(code, 10, 25);
    act(() => expect(result.current.handleBookmarkContextMenu(event)).toBe(true));
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.bookmarkSelection).toMatchObject({ targetKind: 'code', x: 10, y: 25, presentation: 'menu', documentText: source });
    act(() => result.current.closeBookmarkSelection());
    expect(result.current.bookmarkSelection).toBeNull();
    act(() => expect(result.current.openBookmarkDialogForElement(code, 2, 4)).toBe(true));
    expect(result.current.bookmarkSelection).toMatchObject({ targetKind: 'code', x: 2, y: 4, presentation: 'dialog' });
  });

  it.each([
    { enabled: false }, { currentFile: null }, { isFullHtmlPreview: true },
    { bodyRef: { current: null } }, { markdownSource: null },
  ])('leaves the context menu untouched when capture is unavailable: %j', (overrides) => {
    const props = selectionFixture();
    const code = props.bodyRef.current!.querySelector('code')!;
    const { result } = renderHook(useBookmarkSelection, { initialProps: { ...props, ...overrides } });
    const event = mouse(code);
    expect(result.current.handleBookmarkContextMenu(event)).toBe(false);
    expect(result.current.openBookmarkDialogForElement(code, 0, 0)).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(props.closeLinkMenu).not.toHaveBeenCalled();
  });
});

describe('bookmark selection menu', () => {
  it('positions and focuses the menu, then saves the named selection and reports success', () => {
    const props = menuProps();
    const notice = vi.fn();
    window.addEventListener(ACTION_NOTICE_EVENT, notice, { once: true });
    try {
      render(<BookmarkSelectionMenu {...props} />);
      const menu = screen.getByRole('menu', { name: translations.menuLabel });
      const add = screen.getByRole('menuitem', { name: translations.addSelection });
      expect(add).toHaveFocus();
      expect(menu.style.getPropertyValue('--link-context-menu-left')).toBe('8px');
      expect(menu.style.getPropertyValue('--link-context-menu-top')).toBe(`${window.innerHeight - 8}px`);
      fireEvent.pointerDown(add);
      fireEvent.keyDown(add, { key: 'Tab' });
      expect(props.onClose).not.toHaveBeenCalled();
      fireEvent.click(add);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      const name = screen.getByRole('textbox', { name: translations.nameLabel });
      expect(name).toHaveValue('Hello world');
      fireEvent.change(name, { target: { value: ' My selection ' } });
      fireEvent.click(screen.getByRole('button', { name: translations.save }));
      expect(bookmarkStore.getSnapshot().items).toEqual([
        expect.objectContaining({ filePath, name: 'My selection', sourceAnchor: expect.objectContaining({ fragment: 'Hello world' }) }),
      ]);
      expect(notice).toHaveBeenCalledWith(expect.objectContaining({ detail: { message: translations.savedSuccess, tone: 'success' } }));
      expect(props.onClose).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(ACTION_NOTICE_EVENT, notice);
    }
  });

  it('closes for outside pointer, scroll, resize, or Escape and removes handlers on unmount', () => {
    const props = menuProps();
    const { unmount } = render(<BookmarkSelectionMenu {...props} />);
    fireEvent.pointerDown(document.body);
    fireEvent.scroll(window);
    fireEvent.resize(window);
    expect(fireEvent.keyDown(screen.getByRole('menuitem'), { key: 'Escape' })).toBe(false);
    expect(props.onClose).toHaveBeenCalledTimes(4);
    unmount();
    fireEvent.pointerDown(document.body);
    expect(props.onClose).toHaveBeenCalledTimes(4);
  });

  it.each([
    ['invalid target', { sourceEnd: 0 }, translations.targetUnavailable, 'Could not save: {reason}', false],
    ['failed storage', {}, translations.storageUnavailable, 'Could not save.', true],
  ] as const)('keeps the direct dialog open for %s', (_label, selection, reason, saveFailed, storageError) => {
    if (storageError) vi.spyOn(bookmarkStore, 'add').mockImplementation(() => { throw new Error('storage unavailable'); });
    const notice = vi.fn();
    window.addEventListener(ACTION_NOTICE_EVENT, notice, { once: true });
    try {
      const props = menuProps({ state: { ...state, ...selection, presentation: 'dialog' }, translations: { ...translations, saveFailed } });
      render(<BookmarkSelectionMenu {...props} />);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: translations.save }));
      expect(notice).toHaveBeenCalledWith(expect.objectContaining({
        detail: { message: storageError ? `${saveFailed} ${reason}` : saveFailed.replace('{reason}', reason), tone: 'error' },
      }));
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    } finally {
      window.removeEventListener(ACTION_NOTICE_EVENT, notice);
    }
  });

  it('renders nothing without a selection or file', () => {
    const { rerender } = render(<BookmarkSelectionMenu {...menuProps({ state: null })} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    rerender(<BookmarkSelectionMenu {...menuProps({ filePath: null })} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it.each([true, false])('suggests a diagram label with explicit identity: %s', (withIdentity) => {
    const diagram = 'flowchart LR\nA[Start] --> B[Finish]';
    render(<BookmarkSelectionMenu {...menuProps({
      state: {
        ...state, targetKind: 'mermaid', presentation: 'dialog',
        renderedText: withIdentity ? 'Rendered label' : diagram,
        objectIdentity: withIdentity ? { mermaidSource: diagram } : undefined,
      },
    })} />);
    expect(screen.getByRole('textbox', { name: translations.nameLabel })).toHaveValue('Start');
  });
});
