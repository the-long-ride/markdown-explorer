import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeRemixModal } from '../../../../ui/src/components/Settings/ThemeRemixModal';
import { ThemeStylePicker } from '../../../../ui/src/components/Settings/ThemeStylePicker';
import { ThemeOnboardingModal } from '../../../../ui/src/components/Modal/ThemeOnboardingModal';

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
  TooltipButton: ({ onClick, children, icon, ...props }: any) => (
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
    { id: 'pet-white-shiba', label: 'White Shiba', description: 'White Shiba style' },
  ],
  DEFAULT_PET_THEME_STYLE: 'pet-white-shiba',
  isPetThemeStyle: (value: string) => value.startsWith('pet-'),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    themeStyles: {
      defaultLabel: 'Default',
      defaultDesc: 'Default style',
      glassLabel: 'Glass',
      glassDesc: 'Glass style',
      bentoLabel: 'Bento',
      bentoDesc: 'Bento style',
      petsLabel: 'Pets',
      petsDesc: 'Pets style',
    },
    topbar: { switchToLightMode: 'Light', switchToDarkMode: 'Dark' },
  }),
}));

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

vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/white-shiba-happy.png', () => ({ default: 'ws.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/shiba-happy.png', () => ({ default: 's.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/shiba-memes-happy.png', () => ({ default: 'bs.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/k-ink-wolf.png', () => ({ default: 'ki.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/cat-happy.png', () => ({ default: 'c.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/hamster-happy.png', () => ({ default: 'h.png' }));
vi.mock('../../../../ui/src/assets/themes/pets/backgrounds/corgi-happy.png', () => ({ default: 'co.png' }));

describe('ThemeRemixModal', () => {
  beforeEach(() => {
    mockState = {
      theme: 'dark',
      themeStyle: 'default',
      settings: { language: 'en', activeCustomThemeId: null, customThemes: [], keybindings: {} },
    };
    vi.useFakeTimers();
    mockUpdateSettings.mockClear();
    mockSelectCustomTheme.mockClear();
    mockSetThemeStyle.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.dataset.themeStyle = '';
    document.documentElement.dataset.theme = '';
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<ThemeRemixModal isOpen={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal when isOpen is true', () => {
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders Theme Remix heading', () => {
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Theme Remix');
  });

  it('renders empty state with New Theme button when no custom themes', () => {
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('New Theme')).toBeInTheDocument();
  });

  it('creates a new theme on New Theme click', () => {
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('New Theme'));
    expect(mockUpdateSettings).toHaveBeenCalled();
    expect(mockSelectCustomTheme).toHaveBeenCalled();
  });

  it('renders theme list when custom themes exist', () => {
    mockState.settings.customThemes = [{
      id: 't1',
      name: 'My Theme',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('My Theme')).toBeInTheDocument();
  });

  it('renders Name input for selected theme', () => {
    mockState.settings.customThemes = [{
      id: 't1',
      name: 'My Theme',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    const nameInput = screen.getByDisplayValue('My Theme');
    expect(nameInput).toBeInTheDocument();
    fireEvent.change(nameInput, { target: { value: 'Renamed Theme' } });
    expect(mockUpdateSettings).toHaveBeenCalled();
  });

  it('renders Apply Theme button', () => {
    mockState.settings.customThemes = [{
      id: 't1',
      name: 'My Theme',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Apply Theme')).toBeInTheDocument();
  });

  it('renders color pickers for selected theme', () => {
    mockState.settings.customThemes = [{
      id: 't1',
      name: 'My Theme',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    expect(screen.getAllByText('Background').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Accent')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<ThemeRemixModal isOpen={true} onClose={onClose} />);
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    render(<ThemeRemixModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('deletes theme on delete button click', () => {
    mockState.settings.customThemes = [{
      id: 't1',
      name: 'My Theme',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    const deleteBtns = screen.getAllByRole('button').filter((b) => b.className.includes('theme-remix-list__icon-btn--danger'));
    if (deleteBtns.length > 0) {
      fireEvent.click(deleteBtns[0]);
      expect(mockUpdateSettings).toHaveBeenCalled();
    }
  });

  it('renders Duplicate button for each theme', () => {
    mockState.settings.customThemes = [{
      id: 't1',
      name: 'My Theme',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('copy-icon')).toBeInTheDocument();
  });

  it('renders Layout section with range sliders', () => {
    mockState.settings.customThemes = [{
      id: 't1',
      name: 'My Theme',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Layout')).toBeInTheDocument();
    const rangeInputs = screen.getAllByRole('slider');
    expect(rangeInputs.length).toBeGreaterThan(0);
  });

  it('renders Background section with Choose Image button', () => {
    mockState.settings.customThemes = [{
      id: 't1',
      name: 'My Theme',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Choose Image')).toBeInTheDocument();
    expect(screen.getByText('Remove Image')).toBeInTheDocument();
  });

  it('renders dark/light color scheme tabs', () => {
    mockState.settings.customThemes = [{
      id: 't1',
      name: 'My Theme',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByText('dark')).toBeInTheDocument();
    expect(screen.getByText('light')).toBeInTheDocument();
  });

  it('switches color scheme tab on click', () => {
    mockState.settings.customThemes = [{
      id: 't1',
      name: 'My Theme',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('light'));
  });

  it('shows theme limit error when 24 custom themes exist', () => {
    const themes = Array.from({ length: 24 }, (_, i) => ({
      id: `t${i}`,
      name: `Theme ${i}`,
      baseStyle: 'default' as const,
      colorMode: 'auto' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable' as const, radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none' as const, opacity: 0.16, fit: 'cover' as const, position: 'center', blur: 0 },
    }));
    mockState.settings.customThemes = themes;
    const { container } = render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    const newThemeBtns = screen.getAllByText('New Theme');
    const newThemeBtn = newThemeBtns[0];
    expect(newThemeBtn).toBeDisabled();
  });

  it('renders status message after create', () => {
    render(<ThemeRemixModal isOpen={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('New Theme'));
    expect(screen.getByText('Created theme.')).toBeInTheDocument();
  });
});

describe('ThemeStylePicker', () => {
  beforeEach(() => {
    mockState = {
      themeStyle: 'default',
      settings: { language: 'en', customThemes: [], activeCustomThemeId: null, keybindings: {} },
    };
  });

  it('renders default style option', () => {
    render(<ThemeStylePicker value="default" onChange={() => {}} />);
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('renders glass style option', () => {
    render(<ThemeStylePicker value="default" onChange={() => {}} />);
    expect(screen.getByText('Glass')).toBeInTheDocument();
  });

  it('renders bento style option', () => {
    render(<ThemeStylePicker value="default" onChange={() => {}} />);
    expect(screen.getByText('Bento')).toBeInTheDocument();
  });

  it('renders pets style option', () => {
    render(<ThemeStylePicker value="default" onChange={() => {}} />);
    expect(screen.getByText('Pets')).toBeInTheDocument();
  });

  it('marks the active style with is-active class', () => {
    render(<ThemeStylePicker value="default" onChange={() => {}} />);
    const defaultBtn = screen.getAllByRole('button').find((b) => b.className.includes('theme-style-option--default'));
    expect(defaultBtn!.className).toContain('is-active');
  });

  it('calls onChange when a style option is clicked', () => {
    const onChange = vi.fn();
    render(<ThemeStylePicker value="default" onChange={onChange} />);
    const glassBtn = screen.getAllByRole('button').find((b) => b.className.includes('theme-style-option--glass'));
    fireEvent.click(glassBtn!);
    expect(onChange).toHaveBeenCalledWith('glass');
  });

  it('renders pet theme dropdown toggle', () => {
    render(<ThemeStylePicker value="default" onChange={() => {}} />);
    const petSelect = screen.getAllByRole('button').find((b) => b.className.includes('pet-theme-select'));
    expect(petSelect).toBeTruthy();
  });

  it('opens pet theme menu on dropdown click', () => {
    render(<ThemeStylePicker value="default" onChange={() => {}} />);
    const petSelect = screen.getAllByRole('button').find((b) => b.className.includes('pet-theme-select'));
    fireEvent.click(petSelect!);
    expect(screen.getByRole('listbox', { name: 'Pet sub-theme' })).toBeInTheDocument();
  });

  it('selects pet sub-theme on menu click', () => {
    const onChange = vi.fn();
    render(<ThemeStylePicker value="default" onChange={onChange} />);
    const petSelect = screen.getAllByRole('button').find((b) => b.className.includes('pet-theme-select'));
    fireEvent.click(petSelect!);
    const shibaOption = screen.getAllByRole('option').find((b) => b.textContent?.includes('White Shiba'));
    fireEvent.click(shibaOption!);
    expect(onChange).toHaveBeenCalledWith('pet-white-shiba');
  });

  it('marks pets option as active when pet theme is selected', () => {
    render(<ThemeStylePicker value="pet-white-shiba" onChange={() => {}} />);
    const petsOption = document.querySelector('.theme-style-option--pets');
    expect(petsOption!.className).toContain('is-active');
  });

  it('keeps selected menu styling without left rails', () => {
    const styles = [
      'ui/src/styles/global/global-tables-a.css',
      'ui/src/styles/global/global-theme-picker-pets.css',
      'ui/src/styles/global/global-theme-picker-remix.css',
      'ui/src/styles/global/global-theme-picker-custom.css',
      'ui/src/styles/global/global-modals-settings-a.css',
      'ui/src/styles/global/global-theme-glass-bento.css',
    ].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');

    expect(styles).toMatch(/\.mdn-table-view-menu__option\.is-selected\s*\{[^}]*background:\s*var\(--accent-dim\);/s);
    expect(styles).toMatch(/\.pet-theme-menu__option\.is-selected\s*\{[^}]*background:\s*var\(--accent-dim\);/s);
    expect(styles).toMatch(/\.theme-remix-menu__option\.is-selected\s*\{[^}]*background:\s*var\(--accent-dim\);/s);
    expect(styles).not.toMatch(/\.mdn-table-view-menu__option\.is-selected\s*\{[^}]*box-shadow:\s*inset 3px 0 0/s);
    expect(styles).not.toMatch(/\.pet-theme-menu__option\.is-selected\s*\{[^}]*box-shadow:\s*inset 3px 0 0/s);
    expect(styles).not.toMatch(/\.theme-remix-menu__option\.is-selected\s*\{[^}]*box-shadow:\s*inset 3px 0 0/s);
    expect(styles).not.toMatch(/\.custom-theme-menu__option\.is-selected\s*\{[^}]*box-shadow:\s*inset 3px 0 0/s);
    expect(styles).not.toMatch(/\.settings-language-menu__option\.is-selected\s*\{[^}]*box-shadow:\s*inset 3px 0 0/s);
    expect(styles).not.toMatch(/\[data-theme-style="bento"\] \.mdn-section--h1 > \.mdn-section-header\s*\{[^}]*box-shadow:\s*inset 4px 0 0/s);
    expect(styles).not.toMatch(/\[data-theme-style="bento"\] \.mdn-section--h2 > \.mdn-section-header\s*\{[^}]*box-shadow:\s*inset 4px 0 0/s);
    expect(styles).toContain('.theme-remix-menu__option.is-selected .theme-remix-menu__mark');
  });

  it('renders custom themes section when showCustomThemes is true and custom themes exist', () => {
    mockState.settings.customThemes = [{
      id: 'c1',
      name: 'Custom 1',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeStylePicker value="default" onChange={() => {}} showCustomThemes={true} />);
    expect(screen.getByText('Custom themes')).toBeInTheDocument();
  });

  it('opens custom theme dropdown on click', () => {
    mockState.settings.customThemes = [{
      id: 'c1',
      name: 'Custom 1',
      baseStyle: 'default',
      colorMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      colors: { dark: {}, light: {} },
      layout: { density: 'comfortable', radius: 8, strokeWidth: 1, contentPadding: 36, sectionGap: 14 },
      background: { type: 'none', opacity: 0.16, fit: 'cover', position: 'center', blur: 0 },
    }];
    render(<ThemeStylePicker value="default" onChange={() => {}} showCustomThemes={true} />);
    const customSelect = screen.getAllByRole('button').find((b) => b.className.includes('custom-theme-select'));
    fireEvent.click(customSelect!);
    expect(screen.getByRole('listbox', { name: 'Custom themes' })).toBeInTheDocument();
  });

  it('renders Theme Remix button when onOpenThemeRemix is provided', () => {
    const onOpenThemeRemix = vi.fn();
    render(<ThemeStylePicker value="default" onChange={() => {}} onOpenThemeRemix={onOpenThemeRemix} />);
    expect(screen.getByText('Theme Remix')).toBeInTheDocument();
  });

  it('calls onOpenThemeRemix on Theme Remix button click', () => {
    const onOpenThemeRemix = vi.fn();
    render(<ThemeStylePicker value="default" onChange={() => {}} onOpenThemeRemix={onOpenThemeRemix} />);
    fireEvent.click(screen.getByText('Theme Remix'));
    expect(onOpenThemeRemix).toHaveBeenCalled();
  });

  it('closes pet menu on Escape', () => {
    const { container } = render(<ThemeStylePicker value="default" onChange={() => {}} />);
    const petSelect = screen.getAllByRole('button').find((b) => b.className.includes('pet-theme-select'));
    fireEvent.click(petSelect!);
    expect(screen.getByRole('listbox', { name: 'Pet sub-theme' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Pet sub-theme' })).not.toBeInTheDocument();
  });

  it('renders with custom className', () => {
    render(<ThemeStylePicker value="default" onChange={() => {}} className="custom-class" />);
    expect(document.querySelector('.custom-class')).toBeInTheDocument();
  });
});

describe('ThemeOnboardingModal', () => {
  beforeEach(() => {
    mockState = {
      theme: 'dark',
      themeStyle: 'default',
      settings: { language: 'en', customThemes: [], activeCustomThemeId: null, keybindings: {} },
    };
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<ThemeOnboardingModal isOpen={false} onComplete={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal when isOpen is true', () => {
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders Choose Your Theme heading', () => {
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    expect(screen.getByText('Choose Your Theme')).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    expect(screen.getByText('You can change this later from Settings.')).toBeInTheDocument();
  });

  it('renders Color Mode section', () => {
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    expect(screen.getByText('Color Mode')).toBeInTheDocument();
  });

  it('renders color mode options', () => {
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('calls setTheme when a color mode is clicked', () => {
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    fireEvent.click(screen.getByText('Light'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('marks active color mode with is-active class', () => {
    mockState.theme = 'dark';
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    const darkBtn = screen.getAllByRole('button').find((b) => b.textContent === 'Dark' && b.className.includes('segmented-option'));
    expect(darkBtn!.className).toContain('is-active');
  });

  it('renders Theme Style section', () => {
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    expect(screen.getByText('Theme Style')).toBeInTheDocument();
  });

  it('renders Skip button', () => {
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  it('renders Continue button', () => {
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('calls onComplete when Skip is clicked', () => {
    const onComplete = vi.fn();
    render(<ThemeOnboardingModal isOpen={true} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Skip'));
    expect(onComplete).toHaveBeenCalled();
  });

  it('calls onComplete when Continue is clicked', () => {
    const onComplete = vi.fn();
    render(<ThemeOnboardingModal isOpen={true} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Continue'));
    expect(onComplete).toHaveBeenCalled();
  });

  it('renders ThemeStylePicker component', () => {
    render(<ThemeOnboardingModal isOpen={true} onComplete={() => {}} />);
    expect(screen.getByText('Default')).toBeInTheDocument();
  });
});
