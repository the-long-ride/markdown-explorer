import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HtmlPreviewModal } from '../../../../ui/src/components/Modal/HtmlPreviewModal.tsx';

describe('HtmlPreviewModal', () => {
  it('renders modal with title, iframe srcDoc, and close button in body portal', () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);

    const { unmount } = render(
      <HtmlPreviewModal
        documentHtml="<h1>Hello Preview</h1>"
        title="Sample Document Preview"
        closeLabel="Close preview"
        trigger={trigger}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Sample Document Preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close preview' })).toBeInTheDocument();

    const iframe = screen.getByTitle('Sample Document Preview');
    expect(iframe).toHaveAttribute('srcdoc', '<h1>Hello Preview</h1>');
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');

    // Clicking close button calls onClose
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Unmount restores body overflow and focuses trigger
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('closes on Escape key and on backdrop click', () => {
    const onClose = vi.fn();

    render(
      <HtmlPreviewModal
        documentHtml="<p>Content</p>"
        title="Escape Test"
        closeLabel="Close"
        trigger={null}
        onClose={onClose}
      />,
    );

    // Escape key
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Backdrop click
    const backdrop = document.querySelector('.mdn-html-modal-backdrop')!;
    fireEvent.mouseDown(backdrop, { target: backdrop });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('traps tab focus boundaries within the dialog', () => {
    const onClose = vi.fn();

    render(
      <HtmlPreviewModal
        documentHtml="<p>Focus Trap</p>"
        title="Focus Trap Test"
        closeLabel="Close"
        trigger={null}
        onClose={onClose}
      />,
    );

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    const iframe = screen.getByTitle('Focus Trap Test');

    // Shift+Tab from first element (closeBtn) wraps to last element (iframe)
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(iframe);

    // Tab from last element (iframe) wraps to first element (closeBtn)
    iframe.focus();
    expect(document.activeElement).toBe(iframe);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('computes header bottom offset dynamically and responds to window resize', () => {
    const header = document.createElement('header');
    header.getBoundingClientRect = () => ({
      top: 0,
      bottom: 48,
      left: 0,
      right: 1000,
      width: 1000,
      height: 48,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    document.body.appendChild(header);

    render(
      <HtmlPreviewModal
        documentHtml="<p>Header offset</p>"
        title="Header Offset Test"
        closeLabel="Close"
        trigger={null}
        onClose={vi.fn()}
      />,
    );

    const backdrop = document.querySelector('.mdn-html-modal-backdrop') as HTMLElement;
    expect(backdrop.style.getPropertyValue('--mdn-html-modal-top')).toMatch(/\d+px/);

    // Trigger window resize event
    window.dispatchEvent(new Event('resize'));
    expect(backdrop.style.getPropertyValue('--mdn-html-modal-top')).toMatch(/\d+px/);

    header.remove();
  });
});
