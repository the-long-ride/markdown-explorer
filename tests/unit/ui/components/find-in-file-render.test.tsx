import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FindInFilePanel } from '../../../../ui/src/components/Search/FindInFilePanel';

let mdBody: HTMLDivElement;

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: { settings: { language: 'en' } } }),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    search: {
      findDialogLabel: 'Find in current file',
      findPlaceholder: 'Find in current file... ({shortcut})',
      findInputLabel: 'Find text in current file',
      matchCase: 'Match case',
      previousMatch: 'Previous match',
      nextMatch: 'Next match',
      closeFind: 'Close find in file',
    },
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() } as any);
  Element.prototype.scrollIntoView = vi.fn();
  mdBody = document.createElement('div');
  mdBody.id = 'mdBody';
  mdBody.textContent = 'Hello world content here';
  document.body.appendChild(mdBody);
});

afterEach(() => {
  document.querySelectorAll('#mdBody').forEach((node) => node.remove());
  vi.useRealTimers();
});

const defaultOnClose = vi.fn();

describe('FindInFilePanel', () => {

  it('returns null when isOpen is false', () => {
    const { container } = render(<FindInFilePanel isOpen={false} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders find input when open', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders find input with placeholder including shortcut label', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Find in current file... (Ctrl+F)');
  });

  it('renders find input with aria-label', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Find text in current file');
  });

  it('renders previous match button', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByLabelText('Previous match')).toBeInTheDocument();
  });

  it('renders next match button', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByLabelText('Next match')).toBeInTheDocument();
  });

  it('renders close button', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByLabelText('Close find in file')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<FindInFilePanel isOpen={true} onClose={onClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    fireEvent.click(screen.getByLabelText('Close find in file'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key pressed in input', () => {
    const onClose = vi.fn();
    render(<FindInFilePanel isOpen={true} onClose={onClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates to next match on Enter key', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText(/1\//)).toBeInTheDocument();
  });

  it('navigates to previous match on Shift+Enter', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByText(/1\//)).toBeInTheDocument();
  });

  it('shows 0/0 count when query is empty', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('disables navigation buttons when no matches', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByLabelText('Previous match')).toBeDisabled();
    expect(screen.getByLabelText('Next match')).toBeDisabled();
  });

  it('enables navigation buttons when matches exist', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.getByLabelText('Previous match')).not.toBeDisabled();
    expect(screen.getByLabelText('Next match')).not.toBeDisabled();
  });

  it('clicks previous match button', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.click(screen.getByLabelText('Previous match'));
    expect(screen.getByText(/1\//)).toBeInTheDocument();
  });

  it('clicks next match button', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.click(screen.getByLabelText('Next match'));
    expect(screen.getByText(/1\//)).toBeInTheDocument();
  });

  it('clears marks on unmount', () => {
    const { unmount } = render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    act(() => { vi.advanceTimersByTime(50); });
    unmount();
    const marks = document.querySelectorAll('mark.mdn-find-mark');
    expect(marks.length).toBe(0);
  });

  it('resets query and count when panel is closed and reopened', () => {
    const { rerender } = render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    act(() => { vi.advanceTimersByTime(50); });
    rerender(<FindInFilePanel isOpen={false} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    const newMdBody = document.createElement('div');
    newMdBody.id = 'mdBody';
    newMdBody.textContent = 'Hello world content here';
    document.body.appendChild(newMdBody);
    rerender(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('renders with dialog role', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders with aria-label on dialog', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Find in current file');
  });

  it('resets match count when query is cleared', () => {
    render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.change(input, { target: { value: '' } });
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('re-searches when renderVersion changes', () => {
    const { rerender } = render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    act(() => { vi.advanceTimersByTime(50); });
    rerender(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={1} shortcutLabel="Ctrl+F" />);
    act(() => { vi.advanceTimersByTime(50); });
    const marks = document.querySelectorAll('mark.mdn-find-mark');
    expect(marks.length).toBeGreaterThan(0);
  });
});

it('filters current-file matches by case when Match case is enabled', () => {
  mdBody.textContent = 'Alpha alpha ALPHA';
  render(<FindInFilePanel isOpen={true} onClose={defaultOnClose} renderVersion={0} shortcutLabel="Ctrl+F" />);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'Alpha' } });
  act(() => { vi.advanceTimersByTime(50); });
  expect(mdBody.querySelectorAll('mark.mdn-find-mark')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: /Match case/ }));
  act(() => { vi.advanceTimersByTime(50); });
  expect(mdBody.querySelectorAll('mark.mdn-find-mark')).toHaveLength(1);
});
