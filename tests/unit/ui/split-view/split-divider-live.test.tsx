import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SplitDivider } from '../../../../ui/src/components/Content/SplitDivider';
import { applyHtmlPreviewResize } from '../../../../ui/src/dom/globalHandlers';

let frames: FrameRequestCallback[] = [];
beforeEach(() => {
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
const flushFrames = () => { const run = frames; frames = []; run.forEach((cb) => cb(0)); };

function setup(ratio = 0.5) {
  const onRatioChange = vi.fn();
  render(<div className="split-document-view" data-testid="root"><SplitDivider ratio={ratio} onRatioChange={onRatioChange} /></div>);
  const root = screen.getByTestId('root');
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 500, width: 1000, height: 500, toJSON: () => ({}) });
  return { root, divider: screen.getByRole('separator'), onRatioChange };
}

describe('SplitDivider live drag', () => {
  it('updates CSS vars once per frame and commits exactly once on release', () => {
    const { root, divider, onRatioChange } = setup();
    fireEvent.pointerDown(divider, { pointerId: 1, clientX: 500 });
    expect(root.classList.contains('is-split-resizing')).toBe(true);
    expect(document.body.classList.contains('is-split-resizing')).toBe(true);
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 550 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 600 });
    expect(frames).toHaveLength(1);
    flushFrames();
    expect(root.style.getPropertyValue('--split-primary-size')).toBe('0.6fr');
    expect(root.style.getPropertyValue('--split-secondary-size')).toBe('0.4fr');
    expect(divider.getAttribute('aria-valuenow')).toBe('60');
    expect(onRatioChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 650 });
    expect(onRatioChange).toHaveBeenCalledTimes(1);
    expect(onRatioChange).toHaveBeenCalledWith(0.65);
    expect(root.classList.contains('is-split-resizing')).toBe(false);
    expect(document.body.classList.contains('is-split-resizing')).toBe(false);
  });

  it('restores the starting ratio and commits nothing on Escape or pointercancel', () => {
    const { root, divider, onRatioChange } = setup(0.5);
    fireEvent.pointerDown(divider, { pointerId: 2, clientX: 500 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 700 });
    flushFrames();
    expect(root.style.getPropertyValue('--split-primary-size')).toBe('0.7fr');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(root.style.getPropertyValue('--split-primary-size')).toBe('0.5fr');
    expect(root.classList.contains('is-split-resizing')).toBe(false);
    fireEvent.pointerDown(divider, { pointerId: 3, clientX: 500 });
    fireEvent.pointerMove(window, { pointerId: 3, clientX: 700 });
    fireEvent(window, new Event('pointercancel'));
    fireEvent.pointerUp(window, { pointerId: 3, clientX: 700 });
    expect(onRatioChange).not.toHaveBeenCalled();
  });

  it('does not commit when the pointer returns to the starting ratio', () => {
    const { divider, onRatioChange } = setup(0.5);
    fireEvent.pointerDown(divider, { pointerId: 5, clientX: 500 });
    fireEvent.pointerMove(window, { pointerId: 5, clientX: 600 });
    fireEvent.pointerUp(window, { pointerId: 5, clientX: 500 });
    expect(onRatioChange).not.toHaveBeenCalled();
  });

  it('defers HTML preview iframe heights while resizing and flushes them on release', () => {
    const { root, divider } = setup();
    const iframe = document.createElement('iframe');
    iframe.id = 'preview-1';
    root.appendChild(iframe);
    fireEvent.pointerDown(divider, { pointerId: 4, clientX: 500 });
    expect(applyHtmlPreviewResize({ type: 'resize-iframe', id: 'preview-1', height: 321 })).toBe(true);
    expect(iframe.style.height).toBe('');
    fireEvent.pointerUp(window, { pointerId: 4, clientX: 500 });
    expect(iframe.style.height).toBe('321px');
    expect(iframe.dataset.mdnPendingHeight).toBeUndefined();
  });
});
