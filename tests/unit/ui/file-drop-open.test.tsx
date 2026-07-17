import { act, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { useFileDropOpen } from '../../../ui/src/hooks/useFileDropOpen';

function FileDropHarness({
  isDesktop = true,
  modalOpen = false,
  openDroppedPath,
}: {
  isDesktop?: boolean;
  modalOpen?: boolean;
  openDroppedPath: (path: string) => void;
}) {
  const { isDragging } = useFileDropOpen({
    isDesktop,
    isChrome: false,
    modalOpen,
    openDroppedPath,
  });
  return <div data-testid="drag-state">{isDragging ? 'dragging' : 'idle'}</div>;
}

describe('useFileDropOpen', () => {
  test('opens first path from Tauri native file-drop bridge event', () => {
    const openDroppedPath = vi.fn();
    render(<FileDropHarness openDroppedPath={openDroppedPath} />);

    window.dispatchEvent(
      new CustomEvent('markdown-explorer-tauri-file-drop', {
        detail: ['C:\\docs\\workspace', 'C:\\docs\\other.md'],
      }),
    );

    expect(openDroppedPath).toHaveBeenCalledTimes(1);
    expect(openDroppedPath).toHaveBeenCalledWith('C:\\docs\\workspace');
  });

  test('ignores Tauri native file-drop bridge event while modal is open', () => {
    const openDroppedPath = vi.fn();
    render(<FileDropHarness modalOpen openDroppedPath={openDroppedPath} />);

    window.dispatchEvent(
      new CustomEvent('markdown-explorer-tauri-file-drop', {
        detail: ['C:\\docs\\workspace'],
      }),
    );

    expect(openDroppedPath).not.toHaveBeenCalled();
  });

  test('shows drop overlay state while Tauri native file drag is over window', () => {
    const openDroppedPath = vi.fn();
    render(<FileDropHarness openDroppedPath={openDroppedPath} />);

    expect(screen.getByTestId('drag-state')).toHaveTextContent('idle');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('markdown-explorer-tauri-file-drop-state', {
          detail: { type: 'over' },
        }),
      );
    });

    expect(screen.getByTestId('drag-state')).toHaveTextContent('dragging');
    expect(document.body).toHaveClass('is-dragging-files');
  });

  test('hides drop overlay state when Tauri native file drag is cancelled', () => {
    const openDroppedPath = vi.fn();
    render(<FileDropHarness openDroppedPath={openDroppedPath} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('markdown-explorer-tauri-file-drop-state', {
          detail: { type: 'over' },
        }),
      );
      window.dispatchEvent(
        new CustomEvent('markdown-explorer-tauri-file-drop-state', {
          detail: { type: 'cancel' },
        }),
      );
    });

    expect(screen.getByTestId('drag-state')).toHaveTextContent('idle');
    expect(document.body).not.toHaveClass('is-dragging-files');
  });

  test('hides drop overlay when a Tauri native drag leaves without dropping', () => {
    const openDroppedPath = vi.fn();
    render(<FileDropHarness openDroppedPath={openDroppedPath} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('markdown-explorer-tauri-file-drop-state', {
          detail: { type: 'over' },
        }),
      );
      window.dispatchEvent(
        new CustomEvent('markdown-explorer-tauri-file-drop-state', {
          detail: { type: 'leave' },
        }),
      );
    });

    expect(screen.getByTestId('drag-state')).toHaveTextContent('idle');
    expect(document.body).not.toHaveClass('is-dragging-files');
    expect(openDroppedPath).not.toHaveBeenCalled();
  });

  test('hides drop overlay when the desktop window loses focus during a drag', () => {
    const openDroppedPath = vi.fn();
    render(<FileDropHarness openDroppedPath={openDroppedPath} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('markdown-explorer-tauri-file-drop-state', {
          detail: { type: 'over' },
        }),
      );
      window.dispatchEvent(new Event('blur'));
    });

    expect(screen.getByTestId('drag-state')).toHaveTextContent('idle');
    expect(document.body).not.toHaveClass('is-dragging-files');
  });

  test('does not show Tauri native drop overlay while modal is open', () => {
    const openDroppedPath = vi.fn();
    render(<FileDropHarness modalOpen openDroppedPath={openDroppedPath} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('markdown-explorer-tauri-file-drop-state', {
          detail: { type: 'over' },
        }),
      );
    });

    expect(screen.getByTestId('drag-state')).toHaveTextContent('idle');
    expect(document.body).not.toHaveClass('is-dragging-files');
  });
});
