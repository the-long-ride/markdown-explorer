import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupportPromptModal } from '../../../../ui/src/components/Modal/SupportPromptModal';

const mockState: any = {
  theme: 'dark',
  settings: { language: 'en' },
};

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mockState }),
}));

describe('SupportPromptModal', () => {
  beforeEach(() => {
    mockState.settings.language = 'en';
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SupportPromptModal isOpen={false} onClose={vi.fn()} onStar={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog with English translations by default', () => {
    render(<SupportPromptModal isOpen={true} onClose={vi.fn()} onStar={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Enjoying Markdown Explorer?')).toBeInTheDocument();
    expect(screen.getByText(/You've been using Markdown Explorer for a while/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Star on GitHub/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maybe later' })).toBeInTheDocument();
    expect(screen.getByText("Don't show this again")).toBeInTheDocument();
  });

  it('renders localized content for other languages (e.g. Vietnamese)', () => {
    mockState.settings.language = 'vi';
    render(<SupportPromptModal isOpen={true} onClose={vi.fn()} onStar={vi.fn()} />);

    expect(screen.getByText('Bạn có thích Markdown Explorer không?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tặng sao trên GitHub/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Để sau' })).toBeInTheDocument();
    expect(screen.getByText('Không hiển thị lại')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
  });

  it('triggers onStar callback with checkbox state', () => {
    const onStar = vi.fn();
    const onClose = vi.fn();
    render(<SupportPromptModal isOpen={true} onClose={onClose} onStar={onStar} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    // Unchecked state has the unchecked SVG icon
    const customCheckbox = document.querySelector('.support-prompt-card__checkbox-custom');
    expect(customCheckbox?.querySelector('path[d*="M4 3h16"]')).not.toBeNull();

    // Click star without checkbox
    fireEvent.click(screen.getByRole('button', { name: /Star on GitHub/i }));
    expect(onStar).toHaveBeenCalledWith(false);

    // Toggle checkbox and click star
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    // Checked state has the checked SVG icon with rect and rotated transformation
    expect(customCheckbox?.querySelector('rect[transform*="rotate"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Star on GitHub/i }));
    expect(onStar).toHaveBeenCalledWith(true);
  });

  it('triggers onDonate callback when provided', () => {
    const onDonate = vi.fn();
    render(<SupportPromptModal isOpen={true} onClose={vi.fn()} onStar={vi.fn()} onDonate={onDonate} />);

    const donateBtn = screen.getByRole('button', { name: /Donate/i });
    expect(donateBtn).toBeInTheDocument();
    fireEvent.click(donateBtn);
    expect(onDonate).toHaveBeenCalledWith(false);
  });

  it('triggers onClose when maybe later or close button clicked', () => {
    const onStar = vi.fn();
    const onClose = vi.fn();
    render(<SupportPromptModal isOpen={true} onClose={onClose} onStar={onStar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }));
    expect(onClose).toHaveBeenCalledWith(false);

    // Checkbox checked + close button
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('handles Escape key to close modal', () => {
    const onClose = vi.fn();
    render(<SupportPromptModal isOpen={true} onClose={onClose} onStar={vi.fn()} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    render(<SupportPromptModal isOpen={true} onClose={onClose} onStar={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledWith(false);
  });
});
