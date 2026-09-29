import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDocumentEditingSurface } from '../../../../ui/src/components/Content/useDocumentEditingSurface';

const SOURCE = 'Alpha\n\nBeta';

function createBody() {
  const body = document.createElement('div');
  body.innerHTML = '<p data-mdn-source-start="0" data-mdn-source-end="5">Alpha</p>';
  document.body.appendChild(body);
  return body;
}

function options(overrides: Partial<Parameters<typeof useDocumentEditingSurface>[0]> = {}) {
  return {
    filePath: '/docs/a.md',
    mode: 'inline-edit' as const,
    source: SOURCE,
    hasSession: true,
    bodyRef: { current: createBody() },
    renderVersion: 1,
    language: 'en',
    saving: false,
    dirty: false,
    onSourceChange: vi.fn(),
    onSave: vi.fn(),
    onPreview: vi.fn(),
    ...overrides,
  };
}

describe('useDocumentEditingSurface', () => {
  it('exposes no editor and no plain session for a rendered document', () => {
    const opts = options({ mode: 'rendered' });
    const { result } = renderHook(() => useDocumentEditingSurface(opts));
    expect(result.current.inlineEditor).toBeNull();
    expect(result.current.isPlainMode).toBe(false);
    expect(result.current.bodyProps.plainSession).toBeNull();
    expect(opts.bodyRef.current.querySelector('.mdn-inline-edit-trigger')).toBeNull();
    opts.bodyRef.current.remove();
  });

  it('builds the plain session and forwards source, save and preview callbacks', () => {
    const opts = options({ mode: 'plain', saving: true, dirty: true });
    const { result } = renderHook(() => useDocumentEditingSurface(opts));
    expect(result.current.isPlainMode).toBe(true);
    expect(result.current.bodyProps.plainSession).toMatchObject({ source: SOURCE, saving: true, dirty: true });
    expect(result.current.bodyProps.plainSession?.plainSourceLabel).toBeTruthy();

    result.current.bodyProps.onSourceChange('changed');
    result.current.bodyProps.onSave();
    result.current.bodyProps.onPreview();
    expect(opts.onSourceChange).toHaveBeenCalledWith('changed');
    expect(opts.onSave).toHaveBeenCalledTimes(1);
    expect(opts.onPreview).toHaveBeenCalledTimes(1);
    opts.bodyRef.current.remove();
  });

  it('does not enable editing while another view (history) is suspending the document', () => {
    const opts = options({ mode: 'plain', suspended: true });
    const { result } = renderHook(() => useDocumentEditingSurface(opts));
    expect(result.current.isPlainMode).toBe(false);
    expect(result.current.bodyProps.plainSession).toBeNull();
    const inline = options({ suspended: true });
    renderHook(() => useDocumentEditingSurface(inline));
    expect(inline.bodyRef.current.querySelector('.mdn-inline-edit-trigger')).toBeNull();
    opts.bodyRef.current.remove();
    inline.bodyRef.current.remove();
  });

  it('opens the inline editor and saves once after an apply-and-save shortcut', () => {
    const opts = options();
    const { result, rerender } = renderHook(() => useDocumentEditingSurface(opts));
    expect(result.current.inlineEditor).toBeNull();

    const trigger = opts.bodyRef.current.querySelector('.mdn-inline-edit-trigger') as HTMLButtonElement;
    act(() => trigger.click());
    expect(result.current.inlineEditor).not.toBeNull();

    render(<>{result.current.inlineEditor}</>);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Alpha edited' } });
    fireEvent.keyDown(textarea, { key: 's', ctrlKey: true });

    expect(opts.onSourceChange).toHaveBeenCalledWith('Alpha edited\n\nBeta');
    expect(opts.onSave).toHaveBeenCalledTimes(1);
    rerender();
    expect(opts.onSave).toHaveBeenCalledTimes(1);
    opts.bodyRef.current.remove();
  });

  it('does not save on mount or when the save token has not been bumped', () => {
    const opts = options();
    renderHook(() => useDocumentEditingSurface(opts));
    expect(opts.onSave).not.toHaveBeenCalled();
    opts.bodyRef.current.remove();
  });
});
