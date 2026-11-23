import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeRemixModal } from '../../../../ui/src/components/Settings/ThemeRemixModal';
import { getTranslations } from '../../../../ui/src/contexts/translations';

const mockSetTheme = vi.fn();
const mockSetThemeStyle = vi.fn();
const mockSelectCustomTheme = vi.fn();
const mockUpdateSettings = vi.fn();

let mockState: any = {
  theme: 'dark',
  themeStyle: 'default',
  settings: {
    language: 'en',
    activeCustomThemeId: null,
    customThemes: [],
    keybindings: {},
  },
};

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState,
    setTheme: mockSetTheme,
    setThemeStyle: mockSetThemeStyle,
    selectCustomTheme: mockSelectCustomTheme,
    updateSettings: mockUpdateSettings,
  }),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  CopyIcon: () => <span>copy-icon</span>,
  FolderIcon: () => <span>folder-icon</span>,
  PlusIcon: () => <span>plus-icon</span>,
  TrashIcon: () => <span>trash-icon</span>,
}));

vi.mock('../../../../ui/src/components/shared/TooltipButton', () => ({
  TooltipButton: ({ onClick, children, icon, tooltipPos: _tooltipPos, tooltipAlign: _tooltipAlign, ...props }: any) => (
    <button onClick={onClick} {...props}>{icon}{children}</button>
  ),
}));

vi.mock('../../../../ui/src/contexts/appStateConstants', () => ({
  THEME_MODE_OPTIONS: [
    { id: 'auto', label: 'Auto' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ],
  THEME_STYLE_OPTIONS: [
    { id: 'default', label: 'Default', description: 'Default style' },
    { id: 'glass', label: 'Glass', description: 'Glass style' },
    { id: 'bento', label: 'Bento', description: 'Bento style' },
  ],
  PET_THEME_STYLE_OPTIONS: [
    { id: 'pet-white-shiba', label: 'Nika', description: 'Nika style' },
  ],
  DEFAULT_PET_THEME_STYLE: 'pet-white-shiba',
  isPetThemeStyle: (value: string) => value.startsWith('pet-'),
}));

vi.mock('../../../../ui/src/contexts/translations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../ui/src/contexts/translations')>();
  const en = actual.getTranslations('en');
  return {
    ...actual,
    getTranslations: () => ({
      ...en,
      themeStyles: { ...en.themeStyles,
        defaultLabel: 'Default',
        defaultDesc: 'Default style',
        glassLabel: 'Glass',
        glassDesc: 'Glass style',
        bentoLabel: 'Bento',
        bentoDesc: 'Bento style',
        petsLabel: 'Pets',
        petsDesc: 'Pets style',
      },
      topbar: { ...en.topbar, switchToLightMode: 'Light', switchToDarkMode: 'Dark' },
    }),
  };
});

vi.mock('../../../../ui/src/theme/customThemes', () => ({
  CUSTOM_THEME_COLOR_OPTIONS: [
    { key: 'bg', label: 'Background', cssVar: '--bg' },
    { key: 'accent', label: 'Accent', cssVar: '--accent' },
  ],
  MAX_CUSTOM_THEMES: 24,
  MAX_BACKGROUND_DATA_URL_LENGTH: 900_000,
}));

vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/*.png', () => ({
  default: 'pet-image.png',
}), { virtual: true });

vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/nika-happy.png', () => ({ default: 'ws.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/shiba-happy.png', () => ({ default: 's.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/shiba-memes-happy.png', () => ({ default: 'bs.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/k-ink-wolf.png', () => ({ default: 'ki.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/cat-happy.png', () => ({ default: 'c.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/hamster-happy.png', () => ({ default: 'h.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/corgi-happy.png', () => ({ default: 'co.png' }));

function makeTheme(overrides: Partial<any> = {}) {
  return {
    id: 't1',
    name: 'Theme One',
    baseStyle: 'default',
    colorMode: 'auto',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    colors: { dark: {}, light: {} },
    layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
    background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    ...overrides,
  };
}

function openDropdownFor(labelText: string) {
  const label = screen.getByText(labelText);
  const select = label.parentElement!.querySelector('.theme-remix-select') as HTMLButtonElement;
  fireEvent.click(select);
  return select;
}

describe('ThemeRemixModal interactions', () => {
  beforeEach(() => {
    mockState = {
      theme: 'dark',
      themeStyle: 'default',
      settings: {
        language: 'en',
        activeCustomThemeId: null,
        customThemes: [],
        keybindings: {},
      },
    };
    mockUpdateSettings.mockClear();
    mockSelectCustomTheme.mockClear();
    mockSetThemeStyle.mockClear();
    mockSetTheme.mockClear();
  });

  afterEach(() => {
    document.documentElement.dataset.themeStyle = '';
    document.documentElement.dataset.theme = '';
  });

  it('creates a theme when New Theme is clicked in the empty state', () => {
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('New Theme'));
    expect(mockUpdateSettings).toHaveBeenCalled();
    expect(mockSelectCustomTheme).toHaveBeenCalled();
    expect(screen.getByText('Created theme.')).toBeInTheDocument();
  });

  it('selects a different theme in the list', () => {
    mockState.settings.customThemes = [
      makeTheme({ id: 't1', name: 'Theme One' }),
      makeTheme({ id: 't2', name: 'Theme Two' }),
    ];
    const { container } = render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Theme Two').closest('button')!);
    const item = container.querySelector('.theme-remix-list__item.is-selected');
    expect(item).toHaveTextContent('Theme Two');
  });

  it('changes base style via the dropdown', () => {
    mockState.settings.customThemes = [makeTheme()];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    openDropdownFor('Base layout');
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Base layout' })).getByText('glass'));
    expect(mockUpdateSettings).toHaveBeenCalled();
    const lastCall = mockUpdateSettings.mock.calls[mockUpdateSettings.mock.calls.length - 1][0];
    expect(lastCall.customThemes[0].baseStyle).toBe('glass');
    expect(screen.queryByRole('listbox', { name: 'Base layout' })).not.toBeInTheDocument();
  });

  it('changes color mode via the dropdown', () => {
    mockState.settings.customThemes = [makeTheme()];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    openDropdownFor('Color mode');
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Color mode' })).getByText('Dark'));
    const lastCall = mockUpdateSettings.mock.calls[mockUpdateSettings.mock.calls.length - 1][0];
    expect(lastCall.customThemes[0].colorMode).toBe('dark');
    expect(screen.queryByRole('listbox', { name: 'Color mode' })).not.toBeInTheDocument();
  });

  it('changes density via the dropdown', () => {
    mockState.settings.customThemes = [makeTheme()];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    openDropdownFor('Density');
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Density' })).getByText('Spacious'));
    const lastCall = mockUpdateSettings.mock.calls[mockUpdateSettings.mock.calls.length - 1][0];
    expect(lastCall.customThemes[0].layout.density).toBe('spacious');
    expect(screen.queryByRole('listbox', { name: 'Density' })).not.toBeInTheDocument();
  });

  it('changes image fit via the dropdown', () => {
    mockState.settings.customThemes = [makeTheme()];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    openDropdownFor('Image fit');
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Image fit' })).getByText('Contain'));
    const lastCall = mockUpdateSettings.mock.calls[mockUpdateSettings.mock.calls.length - 1][0];
    expect(lastCall.customThemes[0].background.fit).toBe('contain');
    expect(screen.queryByRole('listbox', { name: 'Image fit' })).not.toBeInTheDocument();
  });

  it('persists range edits and keeps light and dark colors independent', () => {
    const t = getTranslations('en');
    mockState.settings.customThemes = [makeTheme({ layout: undefined, background: undefined, colors: { dark: { bg: '#123456' } } })];
    render(<ThemeRemixModal isOpen onClose={vi.fn()} />);
    const saved = () => mockUpdateSettings.mock.lastCall?.[0].customThemes[0];
    const slider = (label: string) => screen.getByText(label, { exact: true }).closest('label')!.querySelector('input[type=range]')!;
    expect(slider(t.themeRemix.radius)).toHaveValue('0');
    fireEvent.change(slider(t.themeRemix.radius), { target: { value: '12' } });
    expect(saved().layout).toEqual({ radius: 12 });
    fireEvent.change(slider(t.themeRemix.imageOpacity), { target: { value: '0.32' } });
    expect(saved().background).toEqual({ opacity: 0.32 });
    fireEvent.change(slider(t.themeRemix.blur), { target: { value: '4' } });
    expect(saved().background).toEqual({ blur: 4 });
    const color = screen.getByLabelText(t.themeRemix.colorBg, { selector: 'input[type=color]' });
    expect(color).toHaveValue('#123456');
    const schemes = within(screen.getByRole('tablist', { name: t.themeRemix.colorSchemes }));
    fireEvent.click(schemes.getByRole('button', { name: t.light }));
    expect(color).not.toHaveValue('#123456');
    fireEvent.change(color, { target: { value: '#abc123' } });
    expect(saved().colors).toMatchObject({ dark: { bg: '#123456' }, light: { bg: '#abc123' } });
    fireEvent.click(screen.getByRole('button', { name: t.themeRemix.removeImage }));
    expect(saved().background).toEqual({ type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 });
    fireEvent.click(screen.getByRole('button', { name: t.themeRemix.applyTheme }));
    expect(mockSelectCustomTheme).toHaveBeenCalledExactlyOnceWith('t1');
    expect(screen.getByText(t.themeRemix.appliedTheme)).toHaveAttribute('role', 'status');
  });

  it('rejects a non-image file and previews an uploaded background once saved', async () => {
    const t = getTranslations('en').themeRemix;
    const onClose = vi.fn();
    mockState.settings.customThemes = [makeTheme({ background: { type: 'none', fit: 'contain', opacity: 0.2, position: 'top', blur: 5 } })];
    const { container, rerender } = render(<ThemeRemixModal isOpen onClose={onClose} />);
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    const pick = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.chooseImage) }));
    expect(pick).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent(t.chooseImageFile);
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File(['picture'], 'picture.png', { type: 'image/png' })] } });
    expect(await screen.findByText(t.backgroundImageAdded)).toHaveAttribute('role', 'status');
    const themes = mockUpdateSettings.mock.lastCall?.[0].customThemes;
    expect(themes[0].background).toEqual({ type: 'image', imageDataUrl: 'data:image/png;base64,cGljdHVyZQ==', fit: 'contain', opacity: 0.2, position: 'top', blur: 5 });
    mockState.settings.customThemes = themes;
    rerender(<ThemeRemixModal isOpen onClose={onClose} />);
    expect(screen.getByRole('img', { name: t.backgroundPreview.replace('{name}', 'Theme One') })).toHaveClass('theme-remix-background-preview__image--contain');
    fireEvent.click(screen.getByRole('button', { name: t.removeImage }));
    expect(mockUpdateSettings.mock.lastCall?.[0].customThemes[0].background).toEqual({ type: 'none', fit: 'contain', opacity: 0.2, position: 'top', blur: 5 });
    fireEvent.click(screen.getByRole('heading', { name: t.title }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes a dropdown with Escape without changing the theme', () => {
    mockState.settings.customThemes = [makeTheme()];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    openDropdownFor('Density');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Density' })).not.toBeInTheDocument();
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it('duplicates a theme when duplicate button is clicked', () => {
    mockState.settings.customThemes = [makeTheme()];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('copy-icon').closest('button')!);
    expect(mockUpdateSettings).toHaveBeenCalled();
    const lastCall = mockUpdateSettings.mock.calls[mockUpdateSettings.mock.calls.length - 1][0];
    expect(lastCall.customThemes).toHaveLength(2);
    expect(lastCall.customThemes[1].name).toContain('Copy');
    expect(mockSelectCustomTheme).toHaveBeenCalled();
    expect(screen.getByText('Duplicated theme.')).toBeInTheDocument();
  });

  it('deletes the selected theme and falls back to built-in style', () => {
    mockState.settings.activeCustomThemeId = 't1';
    mockState.settings.customThemes = [makeTheme()];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('trash-icon').closest('button')!);
    const lastCall = mockUpdateSettings.mock.calls[mockUpdateSettings.mock.calls.length - 1][0];
    expect(lastCall.customThemes).toEqual([]);
    expect(mockSetThemeStyle).toHaveBeenCalledWith('default');
    expect(screen.getByText('Deleted theme.')).toBeInTheDocument();
  });

  it('updates the theme name when typing in the name input', () => {
    mockState.settings.customThemes = [makeTheme()];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    const input = screen.getByDisplayValue('Theme One');
    fireEvent.change(input, { target: { value: 'Renamed Theme' } });
    const lastCall = mockUpdateSettings.mock.calls[mockUpdateSettings.mock.calls.length - 1][0];
    expect(lastCall.customThemes[0].name).toBe('Renamed Theme');
  });

  it('calls onClose when clicking the close button', () => {
    const onClose = vi.fn();
    render(<ThemeRemixModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalled();
  });
});
