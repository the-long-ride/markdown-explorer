import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaModal } from '../../../../ui/src/components/Modal/MediaModal';
import { createMediaGallery } from '../../../../ui/src/components/Modal/mediaGallery';
import { TermsModal } from '../../../../ui/src/components/Modal/TermsModal';
import { SwitchWorkspaceModal } from '../../../../ui/src/components/Modal/SwitchWorkspaceModal';
import { WorkspaceSelectionConfirmModal } from '../../../../ui/src/components/Modal/WorkspaceSelectionConfirmModal';

const mockState: any = {
  theme: 'dark',
  settings: { language: 'en' },
  workspaceName: 'MyProject',
};

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mockState, setTheme: () => {} }),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    tooltips: { closeModal: 'Close modal [Esc]', close: 'Close', previous: 'Previous', next: 'Next', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', resetZoom: 'Reset Zoom' },
    topbar: { theme: 'Toggle light/dark mode', switchToDarkMode: 'Switch to Dark mode', switchToLightMode: 'Switch to Light mode' },
    previewActions: { copyImage: 'Copy image to clipboard', saveImagePng: 'Save as image (.PNG)', imageSaved: 'Image saved.', imageSaveFailed: 'Failed to save image.', copyFailed: 'Unable to copy' },
    update: { restartPromptTitle: 'Install update', restartPromptBody: 'Update ready', updateOnExit: 'Update on Exit', restartAndUpdate: 'Restart and Update' },
    terms: {
      logoAlt: 'Markdown Explorer',
      welcomeTitle: 'Welcome to Markdown Explorer',
      introBefore: 'Please read the',
      privacyPolicy: 'Privacy Policy',
      conjunction: 'and the',
      termsOfService: 'Terms of Service',
      introAfter: 'before continuing.',
      agreement: 'I agree',
      continue: 'Continue',
    },
    workspaceSelection: {
      confirmTitle: 'Confirm',
      confirmBody: 'Proceed with the selected workspace?',
      cancel: 'Cancel',
      confirm: 'Confirm',
    },
  }),
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, icon, children, tooltipPos: _tooltipPos, tooltipAlign: _tooltipAlign, ...props }: any) => (
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
  CopyIcon: () => <span>copy-icon</span>,
  SaveImageIcon: () => <span>save-image-icon</span>,
  SunIcon: () => <span>sun-icon</span>,
  MoonIcon: () => <span>moon-icon</span>,
}));

vi.mock('../../../../ui/src/assets/logos/logo-500.png?inline', () => ({ default: 'logo.png' }));

describe('MediaModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when gallery is null', () => {
    const { container } = render(<MediaModal gallery={null} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when gallery has no items', () => {
    const { container } = render(<MediaModal gallery={{ items: [], currentIndex: 0 }} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders an image snapshot', () => {
    const onClose = vi.fn();
    render(<MediaModal gallery={{ items: [{ type: 'img', src: 'https://example.com/image.png' }], currentIndex: 0 }} onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const modalImg = document.querySelector('.mdn-modal-content-img') as HTMLImageElement;
    expect(modalImg.src).toBe('https://example.com/image.png');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<MediaModal gallery={{ items: [{ type: 'img', src: 'https://example.com/image.png' }], currentIndex: 0 }} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(/Close modal/));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders a captured Mermaid SVG after the source DOM is replaced', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mdn-mermaid-wrap';
    wrapper.dataset.mdnMermaidKind = 'sequence';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = '<circle cx="50" cy="50" r="40" />';
    wrapper.appendChild(svg);
    const body = document.createElement('div');
    body.className = 'mdn-body';
    body.appendChild(wrapper);
    document.body.appendChild(body);

    const gallery = createMediaGallery(wrapper);
    expect(gallery).not.toBeNull();
    expect(gallery?.items[0].kind).toBe('sequence');
    body.innerHTML = '<pre>raw mermaid source</pre>';

    render(<MediaModal gallery={gallery} onClose={() => {}} />);
    const svgContainer = document.querySelector('.mdn-modal-content-svg') as HTMLElement | null;
    expect(svgContainer?.querySelector('svg')).toBeTruthy();
    expect(svgContainer?.getAttribute('data-mdn-mermaid-kind')).toBe('sequence');
  });

  it('renders navigation when multiple snapshots exist', () => {
    render(<MediaModal gallery={{
      items: [
        { type: 'img', src: 'https://example.com/a.png' },
        { type: 'img', src: 'https://example.com/b.png' },
      ],
      currentIndex: 0,
    }} onClose={() => {}} />);
    expect(document.querySelector('.mdn-modal-nav')).toBeTruthy();
  });

  it('captures explicit pixel dimensions for svgs rendered with width="100%"', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mdn-mermaid-wrap';
    wrapper.dataset.mdnMermaidKind = 'packet';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('viewBox', '0 0 640 80');
    svg.innerHTML = '<rect x="0" y="0" width="640" height="80" />';
    wrapper.appendChild(svg);
    const body = document.createElement('div');
    body.className = 'mdn-body';
    body.appendChild(wrapper);
    document.body.appendChild(body);

    // jsdom measures 0×0 by default — emulate the rendered layout width/height.
    const rectSpy = vi.spyOn(svg, 'getBoundingClientRect');
    rectSpy.mockReturnValue({
      width: 1128, height: 141, x: 0, y: 0,
      top: 0, left: 0, right: 1128, bottom: 141,
      toJSON: () => ({}),
    });

    const gallery = createMediaGallery(wrapper);
    const html = gallery?.items[0]?.html ?? '';
    expect(html).toContain('width="1128"');
    expect(html).toContain('height="141"');

    render(<MediaModal gallery={gallery} onClose={() => {}} />);
    const injected = document.querySelector('.mdn-modal-content-svg svg');
    expect(injected?.getAttribute('width')).toBe('1128');
    expect(injected?.getAttribute('height')).toBe('141');

    rectSpy.mockRestore();
  });

  it('falls back to viewBox ratio when the svg has no rendered size', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mdn-mermaid-wrap';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('viewBox', '0 0 640 320');
    svg.innerHTML = '<rect x="0" y="0" width="640" height="320" />';
    wrapper.appendChild(svg);
    const body = document.createElement('div');
    body.className = 'mdn-body';
    body.appendChild(wrapper);
    document.body.appendChild(body);

    const gallery = createMediaGallery(wrapper);
    const html = gallery?.items[0]?.html ?? '';
    expect(html).toContain('width="900"');
    expect(html).toContain('height="450"');
  });

  it('keeps existing pixel attributes when no rendered size is available', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mdn-mermaid-wrap';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '512');
    svg.setAttribute('height', '256');
    svg.innerHTML = '<rect x="0" y="0" width="512" height="256" />';
    wrapper.appendChild(svg);
    const body = document.createElement('div');
    body.className = 'mdn-body';
    body.appendChild(wrapper);
    document.body.appendChild(body);

    const gallery = createMediaGallery(wrapper);
    const html = gallery?.items[0]?.html ?? '';
    expect(html).toContain('width="512"');
    expect(html).toContain('height="256"');
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
