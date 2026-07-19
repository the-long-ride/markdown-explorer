import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaModal } from '../../../../ui/src/components/Modal/MediaModal';
import { TermsModal } from '../../../../ui/src/components/Modal/TermsModal';
import { SwitchWorkspaceModal } from '../../../../ui/src/components/Modal/SwitchWorkspaceModal';
import { WorkspaceSelectionConfirmModal } from '../../../../ui/src/components/Modal/WorkspaceSelectionConfirmModal';

const mockState: any = {
  settings: { language: 'en' },
  workspaceName: 'MyProject',
};

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mockState }),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    tooltips: { closeModal: 'Close modal [Esc]', close: 'Close', previous: 'Previous', next: 'Next', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', resetZoom: 'Reset Zoom' },
    update: { restartPromptTitle: 'Install update', restartPromptBody: 'Update ready', updateOnExit: 'Update on Exit', restartAndUpdate: 'Restart and Update' },
  }),
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, icon, children, ...props }: any) => (
    <button onClick={onClick} {...props}>{icon}{children}</button>
  ),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  CloseIcon: ({ size }: any) => <span>close-icon</span>,
  ZoomInIcon: () => <span>zoom-in-icon</span>,
  ZoomOutIcon: () => <span>zoom-out-icon</span>,
  ResetZoomIcon: () => <span>reset-zoom-icon</span>,
  ChevronLeftIcon: () => <span>chevron-left-icon</span>,
  ChevronRightIcon: () => <span>chevron-right-icon</span>,
}));

vi.mock('../../../../ui/src/assets/logos/logo-500.png?inline', () => ({ default: 'logo.png' }));

describe('MediaModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<MediaModal isOpen={false} onClose={() => {}} clickedElement={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when isOpen is true but no media found', () => {
    const { container } = render(<MediaModal isOpen={true} onClose={() => {}} clickedElement={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when isOpen is true and media is available', () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/image.png';
    const body = document.createElement('div');
    body.className = 'mdn-body';
    body.appendChild(img);
    document.body.appendChild(body);

    const onClose = vi.fn();
    render(<MediaModal isOpen={true} onClose={onClose} clickedElement={img} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/image.png';
    const body = document.createElement('div');
    body.className = 'mdn-body';
    body.appendChild(img);
    document.body.appendChild(body);

    const onClose = vi.fn();
    render(<MediaModal isOpen={true} onClose={onClose} clickedElement={img} />);
    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the image with correct src', () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/test.png';
    const body = document.createElement('div');
    body.className = 'mdn-body';
    body.appendChild(img);
    document.body.appendChild(body);

    render(<MediaModal isOpen={true} onClose={() => {}} clickedElement={img} />);
    const modalImg = document.querySelector('.mdn-modal-content-img') as HTMLImageElement;
    expect(modalImg).toBeTruthy();
    expect(modalImg.src).toBe('https://example.com/test.png');
  });

  it('renders SVG type media correctly', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mdn-mermaid-wrap';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = '<circle cx="50" cy="50" r="40" />';
    wrapper.appendChild(svg);
    const body = document.createElement('div');
    body.className = 'mdn-body';
    body.appendChild(wrapper);
    document.body.appendChild(body);

    render(<MediaModal isOpen={true} onClose={() => {}} clickedElement={wrapper} />);
    const svgContainer = document.querySelector('.mdn-modal-content-svg');
    expect(svgContainer).toBeTruthy();
  });

  it('renders navigation when multiple items exist', () => {
    const img1 = document.createElement('img');
    img1.src = 'https://example.com/a.png';
    const img2 = document.createElement('img');
    img2.src = 'https://example.com/b.png';
    const body = document.createElement('div');
    body.className = 'mdn-body';
    body.appendChild(img1);
    body.appendChild(img2);
    document.body.appendChild(body);

    render(<MediaModal isOpen={true} onClose={() => {}} clickedElement={img1} />);
    const nav = document.querySelector('.mdn-modal-nav');
    expect(nav).toBeTruthy();
  });
});

describe('TermsModal', () => {
  it('returns null when isOpen is false', () => {
    const { container } = render(<TermsModal isOpen={false} onAgree={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when isOpen is true', () => {
    render(<TermsModal isOpen={true} onAgree={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders welcome heading', () => {
    render(<TermsModal isOpen={true} onAgree={() => {}} />);
    expect(screen.getByText('Welcome to Markdown Explorer')).toBeInTheDocument();
  });

  it('renders Privacy Policy and Terms of Service links', () => {
    render(<TermsModal isOpen={true} onAgree={() => {}} />);
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });

  it('renders checkbox for agreement', () => {
    render(<TermsModal isOpen={true} onAgree={() => {}} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('disables continue button when checkbox is unchecked', () => {
    render(<TermsModal isOpen={true} onAgree={() => {}} />);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).toBeDisabled();
  });

  it('enables continue button when checkbox is checked', () => {
    render(<TermsModal isOpen={true} onAgree={() => {}} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls onAgree when continue button is clicked after checking', () => {
    const onAgree = vi.fn();
    render(<TermsModal isOpen={true} onAgree={onAgree} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const btn = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(btn);
    expect(onAgree).toHaveBeenCalled();
  });

  it('calls onOpenExternal when link is clicked', () => {
    const onOpenExternal = vi.fn();
    render(<TermsModal isOpen={true} onAgree={() => {}} onOpenExternal={onOpenExternal} />);
    const privacyLink = screen.getByText('Privacy Policy');
    fireEvent.click(privacyLink);
    expect(onOpenExternal).toHaveBeenCalledWith(
      'https://the-long-ride.github.io/markdown-explorer/privacy.html',
    );
  });

  it('calls onOpenExternal for Terms of Service link', () => {
    const onOpenExternal = vi.fn();
    render(<TermsModal isOpen={true} onAgree={() => {}} onOpenExternal={onOpenExternal} />);
    const termsLink = screen.getByText('Terms of Service');
    fireEvent.click(termsLink);
    expect(onOpenExternal).toHaveBeenCalledWith(
      'https://the-long-ride.github.io/markdown-explorer/terms.html',
    );
  });
});

describe('SwitchWorkspaceModal', () => {
  beforeEach(() => {
    mockState.settings = { language: 'en' };
    mockState.workspaceName = 'MyProject';
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <SwitchWorkspaceModal isOpen={false} onClose={() => {}} onConfirm={() => {}} targetPath="/new/path" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders when isOpen is true', () => {
    render(
      <SwitchWorkspaceModal isOpen={true} onClose={() => {}} onConfirm={() => {}} targetPath="/new/workspace" />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the Switch Workspace title', () => {
    render(
      <SwitchWorkspaceModal isOpen={true} onClose={() => {}} onConfirm={() => {}} targetPath="/new/workspace" />,
    );
    expect(screen.getByText('Switch Workspace')).toBeInTheDocument();
  });

  it('renders the target path name in the message', () => {
    render(
      <SwitchWorkspaceModal isOpen={true} onClose={() => {}} onConfirm={() => {}} targetPath="/new/workspace" />,
    );
    expect(screen.getByText('Switch to "workspace"?')).toBeInTheDocument();
  });

  it('renders current workspace name', () => {
    render(
      <SwitchWorkspaceModal isOpen={true} onClose={() => {}} onConfirm={() => {}} targetPath="/new/workspace" />,
    );
    expect(screen.getByText(/MyProject/)).toBeInTheDocument();
  });

  it('renders cancel and switch buttons', () => {
    render(
      <SwitchWorkspaceModal isOpen={true} onClose={() => {}} onConfirm={() => {}} targetPath="/new/workspace" />,
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Switch')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    render(
      <SwitchWorkspaceModal isOpen={true} onClose={onClose} onConfirm={() => {}} targetPath="/new/workspace" />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onConfirm when switch button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <SwitchWorkspaceModal isOpen={true} onClose={() => {}} onConfirm={onConfirm} targetPath="/new/workspace" />,
    );
    fireEvent.click(screen.getByText('Switch'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <SwitchWorkspaceModal isOpen={true} onClose={onClose} onConfirm={() => {}} targetPath="/new/workspace" />,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders Vietnamese translations when language is vi', () => {
    mockState.settings = { language: 'vi' };
    render(
      <SwitchWorkspaceModal isOpen={true} onClose={() => {}} onConfirm={() => {}} targetPath="/new/workspace" />,
    );
    expect(screen.getByText('Hủy')).toBeInTheDocument();
    expect(screen.getByText('Chuyển')).toBeInTheDocument();
  });
});

describe('WorkspaceSelectionConfirmModal', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <WorkspaceSelectionConfirmModal isOpen={false} onClose={() => {}} onConfirm={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('cancel closes dialog without confirming', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<WorkspaceSelectionConfirmModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirm closes workspace flow', () => {
    const onConfirm = vi.fn();
    render(<WorkspaceSelectionConfirmModal isOpen={true} onClose={() => {}} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('uses stronger backdrop and matching outline action buttons', () => {
    render(<WorkspaceSelectionConfirmModal isOpen={true} onClose={() => {}} onConfirm={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });

    expect(dialog).toHaveClass('workspace-selection-confirm-modal');
    expect(cancel).toHaveClass('workspace-selection-confirm-button', 'workspace-selection-confirm-button--outline');
    expect(confirm).toHaveClass('workspace-selection-confirm-button');
  });

  it('Escape cancels and Enter confirms', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<WorkspaceSelectionConfirmModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
