import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { WelcomePage } from '../../../../ui/src/components/Content/WelcomePage';
import { buildWelcomeTipGroups } from '../../../../ui/src/components/Content/welcomeTipGroups';
import { renderWelcomeDescription } from '../../../../ui/src/components/Content/renderWelcomeDescription';
import { getWelcomeTranslations } from '../../../../ui/src/contexts/welcomeTranslations';
import { useAppState } from '../../../../ui/src/contexts/AppStateContext';

vi.mock('../../../../ui/src/contexts/AppStateContext');

vi.mock('../../../../ui/src/components/shared/InteractiveBackground', () => ({
  InteractiveBackground: () => <div data-testid="interactive-background" />,
}));

describe('WelcomePage and Tips keycaps rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).electronAPI;
  });

  it('renders Switch Focus and Tabs views tip card with default keycaps in WelcomePage', () => {
    vi.mocked(useAppState).mockReturnValue({
      state: {
        settings: {
          language: 'en',
          keybindings: {},
        },
        hostPlatform: 'desktop',
      },
    } as any);

    render(<WelcomePage />);

    // Click Tips tab
    const tipsTabBtn = screen.getByRole('button', { name: /Tips/i });
    fireEvent.click(tipsTabBtn);

    // Locate the "Switch Focus and Tabs views" tip card
    const tipHeading = screen.getByRole('heading', { name: /Switch Focus and Tabs views/i });
    expect(tipHeading).toBeInTheDocument();
    const tipCard = tipHeading.closest('.tip-card');
    expect(tipCard).not.toBeNull();

    // Verify rendered <kbd> elements match Ctrl, Alt, T
    const kbds = tipCard!.querySelectorAll('kbd');
    const kbdTexts = Array.from(kbds).map((k) => k.textContent);
    expect(kbdTexts).toEqual(['Ctrl', 'Alt', 'T']);
  });

  it('dynamically updates rendered <kbd> keycaps when state.keybindings.toggleDesktopViewMode is customized', () => {
    vi.mocked(useAppState).mockReturnValue({
      state: {
        settings: {
          language: 'en',
          keybindings: {},
        },
        keybindings: {
          toggleDesktopViewMode: 'Ctrl+Shift+D',
        },
        hostPlatform: 'desktop',
      },
    } as any);

    render(<WelcomePage />);

    const tipsTabBtn = screen.getByRole('button', { name: /Tips/i });
    fireEvent.click(tipsTabBtn);

    const tipHeading = screen.getByRole('heading', { name: /Switch Focus and Tabs views/i });
    const tipCard = tipHeading.closest('.tip-card')!;

    const kbds = tipCard.querySelectorAll('kbd');
    const kbdTexts = Array.from(kbds).map((k) => k.textContent);
    expect(kbdTexts).toEqual(['Ctrl', 'Shift', 'D']);
  });

  it('dynamically updates rendered <kbd> keycaps when state.settings.keybindings.toggleDesktopViewMode is customized', () => {
    vi.mocked(useAppState).mockReturnValue({
      state: {
        settings: {
          language: 'en',
          keybindings: {
            toggleDesktopViewMode: 'Alt+Shift+V',
          },
        },
        hostPlatform: 'desktop',
      },
    } as any);

    render(<WelcomePage />);

    const tipsTabBtn = screen.getByRole('button', { name: /Tips/i });
    fireEvent.click(tipsTabBtn);

    const tipHeading = screen.getByRole('heading', { name: /Switch Focus and Tabs views/i });
    const tipCard = tipHeading.closest('.tip-card')!;

    const kbds = tipCard.querySelectorAll('kbd');
    const kbdTexts = Array.from(kbds).map((k) => k.textContent);
    expect(kbdTexts).toEqual(['Alt', 'Shift', 'V']);
  });

  it('renders keycaps across multiple languages for tipToggleDesktopView', () => {
    const locales = ['vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'] as const;

    for (const lang of locales) {
      const wt = getWelcomeTranslations(lang);
      const groups = buildWelcomeTipGroups(
        lang,
        {
          keybindings: {
            toggleDesktopViewMode: 'Ctrl+Alt+M',
          },
        } as any,
        wt.tips,
      );

      const navGroup = groups.find((g) => g.id === 'navigateAndOrganize');
      expect(navGroup).toBeDefined();

      const toggleTip = navGroup!.items.find((item) => item.title === wt.tips.tipToggleDesktopView.title);
      expect(toggleTip).toBeDefined();
      expect(toggleTip!.desc).toContain('Ctrl+Alt+M');

      const { container } = render(<div>{renderWelcomeDescription(toggleTip!.desc)}</div>);
      const kbds = container.querySelectorAll('kbd');
      const kbdTexts = Array.from(kbds).map((k) => k.textContent);
      expect(kbdTexts).toContain('Ctrl');
      expect(kbdTexts).toContain('Alt');
      expect(kbdTexts).toContain('M');
    }
  });

  it('renders keycaps for other shortcut tip cards such as HTML preview and containing folder', () => {
    const wt = getWelcomeTranslations('en');
    const groups = buildWelcomeTipGroups(
      'en',
      {
        keybindings: {
          toggleHtmlPreview: 'Ctrl+Alt+H',
          openCurrentDocumentLocation: 'Shift+Alt+R',
        },
      } as any,
      wt.tips,
    );

    const previewGroup = groups.find((g) => g.id === 'previewStructuredContent')!;
    const htmlTip = previewGroup.items.find((item) => item.title === wt.tips.tipToggleHtmlPreview.title)!;
    expect(htmlTip).toBeDefined();

    const { container: htmlContainer } = render(<div>{renderWelcomeDescription(htmlTip.desc)}</div>);
    const htmlKbds = Array.from(htmlContainer.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(htmlKbds).toEqual(['Ctrl', 'Alt', 'H']);

    const navGroup = groups.find((g) => g.id === 'navigateAndOrganize')!;
    const folderTip = navGroup.items.find((item) => item.title === wt.tips.tipOpenContainingFolder.title)!;
    expect(folderTip).toBeDefined();

    const { container: folderContainer } = render(<div>{renderWelcomeDescription(folderTip.desc)}</div>);
    const folderKbds = Array.from(folderContainer.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(folderKbds).toEqual(['Shift', 'Alt', 'R']);
  });

  it('renderWelcomeDescription handles both parenthesized and bare shortcut strings with 3D keycaps', () => {
    const { container: parenContainer } = render(
      <div>{renderWelcomeDescription('Use (Ctrl+Alt+T) to switch view modes')}</div>
    );
    expect(Array.from(parenContainer.querySelectorAll('kbd')).map((k) => k.textContent)).toEqual(['Ctrl', 'Alt', 'T']);

    const { container: bareContainer } = render(
      <div>{renderWelcomeDescription('Use Ctrl+Alt+T to switch view modes')}</div>
    );
    expect(Array.from(bareContainer.querySelectorAll('kbd')).map((k) => k.textContent)).toEqual(['Ctrl', 'Alt', 'T']);
  });
});
