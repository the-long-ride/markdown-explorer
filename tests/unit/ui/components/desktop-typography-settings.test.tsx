import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopTypographySettings } from '../../../../ui/src/components/Settings/DesktopTypographySettings.tsx';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext.tsx';
import { getTranslations } from '../../../../ui/src/contexts/translations.ts';
import { DEFAULT_DESKTOP_FONT_BINDINGS } from '../../../../ui/src/desktop/fonts/fontModel.ts';
import type { AppState } from '../../../../ui/src/contexts/appStateReducer.ts';
import type { DesktopFontFamily } from '../../../../ui/src/desktop/fonts/fontModel.ts';

describe('DesktopTypographySettings', () => {
  const t = getTranslations('en');

  const mockFonts: DesktopFontFamily[] = [
    {
      id: 'custom_1',
      family: 'Custom Sans',
      source: 'imported',
      cssFamily: 'Custom Sans',
      available: true,
      faces: [
        { style: 'normal', minWeight: 400, maxWeight: 400, variable: false },
        { style: 'italic', minWeight: 700, maxWeight: 700, variable: false },
      ],
    },
    {
      id: 'system_1',
      family: 'Arial',
      source: 'system',
      cssFamily: 'Arial',
      available: true,
      faces: [{ style: 'normal', minWeight: 400, maxWeight: 400, variable: false }],
    },
  ];

  function createMockState(overrides: Partial<AppState> = {}): AppState {
    return {
      settings: {
        fontBindings: { ...DEFAULT_DESKTOP_FONT_BINDINGS },
      },
      desktopFonts: mockFonts,
      desktopFontsResult: null,
      desktopFontError: null,
      ...overrides,
    } as unknown as AppState;
  }

  function renderComponent(state: AppState, updateSettings = vi.fn()) {
    const postMessage = vi.fn();
    const bridge = { postMessage } as any;

    const view = (state: AppState) => (
      <PlatformProvider bridge={bridge}>
        <DesktopTypographySettings
          state={state}
          t={t}
          updateSettings={updateSettings}
        />
      </PlatformProvider>
    );
    const utils = render(view(state));

    return { ...utils, postMessage, updateSettings, rerenderState: (state: AppState) => utils.rerender(view(state)) };
  }

  it('renders all typography role headings and initial default font descriptions', () => {
    const state = createMockState();
    renderComponent(state);

    expect(screen.getByText(t.appUiFont)).toBeInTheDocument();
    expect(screen.getByText(t.bodyFont)).toBeInTheDocument();
    expect(screen.getByText(t.headingFont)).toBeInTheDocument();
    expect(screen.getByText(t.quoteFont)).toBeInTheDocument();
    expect(screen.getByText(t.codeFont)).toBeInTheDocument();
    expect(screen.getByText(t.mermaidFont)).toBeInTheDocument();
  });

  it('triggers font import message to platform bridge', () => {
    const state = createMockState();
    const { postMessage } = renderComponent(state);

    const importButtons = screen.getAllByRole('button', { name: t.fontImport });
    fireEvent.click(importButtons[0]);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'importDesktopFonts',
        requestId: expect.stringMatching(/^import-font-appUi/),
      }),
    );
  });

  it('only binds a matching import response to its requested role, and saves the selected font variant', () => {
    const state = createMockState();
    const { postMessage, rerenderState, updateSettings } = renderComponent(state);
    const headingRow = screen.getByText(t.headingFont).closest<HTMLElement>('.desktop-font-binding-row')!;
    const row = within(headingRow);
    const apply = screen.getByRole('button', { name: t.fontApply });
    fireEvent.click(row.getByRole('button', { name: t.fontImport }));
    const requestId = postMessage.mock.lastCall?.[0].requestId;
    expect(requestId).toMatch(/^import-font-heading/);
    rerenderState({ ...state, desktopFontsResult: { requestId: 'another-request', importedId: 'custom_1' } });
    expect(row.getByRole('button', { name: t.fontDefault })).toBeInTheDocument();
    expect(apply).toBeDisabled();

    rerenderState({ ...state, desktopFontsResult: { requestId, importedId: 'custom_1' } });
    expect(row.getByRole('button', { name: 'Custom Sans' })).toBeInTheDocument();
    expect(updateSettings).not.toHaveBeenCalled();
    fireEvent.click(row.getByRole('button', { name: t.fontVariant }));
    fireEvent.click(screen.getByRole('option', { name: `${t.fontItalic} 700` }));
    fireEvent.click(apply);
    const confirm = screen.getByRole('dialog', { name: t.fontApplyConfirmTitle });
    expect(within(confirm).getByText(new RegExp(`Custom Sans · ${t.fontItalic} 700`))).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: t.fontApplyChanges }));
    expect(updateSettings).toHaveBeenCalledExactlyOnceWith({
      fontBindings: {
        ...DEFAULT_DESKTOP_FONT_BINDINGS,
        heading: { source: 'imported', id: 'custom_1', family: 'Custom Sans', weight: 700, style: 'italic', size: 16 },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: t.fontResetAll }));
    expect(row.getByRole('button', { name: t.fontDefault })).toBeInTheDocument();
    expect(apply).toBeDisabled();
  });

  it('keeps the default binding when an import is cancelled or the returned font is unavailable', () => {
    const state = createMockState();
    const { postMessage, rerenderState } = renderComponent(state);
    const row = within(screen.getByText(t.mermaidFont).closest<HTMLElement>('.desktop-font-binding-row')!);
    fireEvent.click(row.getByRole('button', { name: t.fontImport }));
    const requestId = postMessage.mock.lastCall?.[0].requestId;
    expect(requestId).toMatch(/^import-font-mermaid/);
    rerenderState({ ...state, desktopFontsResult: { requestId, importedId: 'unavailable-id' } });
    expect(row.getByRole('button', { name: t.fontDefault })).toBeInTheDocument();
    fireEvent.click(row.getByRole('button', { name: t.fontImport }));
    rerenderState({ ...state, desktopFontsResult: { requestId: postMessage.mock.lastCall?.[0].requestId } });
    expect(row.getByRole('button', { name: t.fontDefault })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.fontApply })).toBeDisabled();
  });

  it('resets a single role back to default bindings', () => {
    const state = createMockState({
      settings: {
        fontBindings: {
          ...DEFAULT_DESKTOP_FONT_BINDINGS,
          body: { source: 'system', family: 'Arial', style: 'normal', weight: 400 },
        },
      } as any,
    });
    renderComponent(state);

    const resetRoleButtons = screen.getAllByRole('button', { name: t.fontResetRole });
    fireEvent.click(resetRoleButtons[1]); // Body role reset

    // Reset All should now be disabled since all match default
    const applyButton = screen.getByRole('button', { name: new RegExp(t.fontApply) });
    expect(applyButton).not.toBeDisabled();
  });

  it('opens confirmation modal on Apply and updates settings on confirm', () => {
    const state = createMockState({
      settings: {
        fontBindings: {
          ...DEFAULT_DESKTOP_FONT_BINDINGS,
          heading: { source: 'system', family: 'Arial', style: 'normal', weight: 400 },
        },
      } as any,
    });
    const { updateSettings } = renderComponent(state);

    // Reset All fonts
    const resetAllBtn = screen.getByRole('button', { name: t.fontResetAll });
    fireEvent.click(resetAllBtn);

    // Apply button becomes enabled
    const applyBtn = screen.getByRole('button', { name: new RegExp(t.fontApply) });
    expect(applyBtn).not.toBeDisabled();
    fireEvent.click(applyBtn);

    // Confirmation dialog appears
    expect(screen.getByRole('dialog', { name: t.fontApplyConfirmTitle })).toBeInTheDocument();

    // Confirm apply
    const confirmBtn = screen.getByRole('button', { name: new RegExp(t.fontApplyChanges) });
    fireEvent.click(confirmBtn);

    expect(updateSettings).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: t.fontApplyConfirmTitle })).not.toBeInTheDocument();
  });

  it('cancels confirmation modal without applying changes', () => {
    const state = createMockState({
      settings: {
        fontBindings: {
          ...DEFAULT_DESKTOP_FONT_BINDINGS,
          heading: { source: 'system', family: 'Arial', style: 'normal', weight: 400 },
        },
      } as any,
    });
    const { updateSettings } = renderComponent(state);

    const resetAllBtn = screen.getByRole('button', { name: t.fontResetAll });
    fireEvent.click(resetAllBtn);

    const applyBtn = screen.getByRole('button', { name: new RegExp(t.fontApply) });
    fireEvent.click(applyBtn);

    const cancelButtons = screen.getAllByRole('button', { name: t.cancelResetShortcuts });
    fireEvent.click(cancelButtons[0]);

    expect(updateSettings).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: t.fontApplyConfirmTitle })).not.toBeInTheDocument();
  });

  it('displays font error message when desktopFontError is set', () => {
    const state = createMockState({
      desktopFontError: 'Failed to read system fonts.',
    });
    renderComponent(state);

    expect(screen.getByRole('status')).toHaveTextContent('Failed to read system fonts.');
  });

  it('handles removal of imported fonts', () => {
    const state = createMockState({
      settings: {
        fontBindings: {
          ...DEFAULT_DESKTOP_FONT_BINDINGS,
          quote: { source: 'imported', id: 'custom_1', family: 'Custom Sans', style: 'normal', weight: 400 },
        },
      } as any,
    });
    const { postMessage } = renderComponent(state);

    const removeBtn = screen.getByRole('button', { name: t.fontRemove });
    fireEvent.click(removeBtn);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'removeImportedDesktopFont',
        id: 'custom_1',
      }),
    );
  });
  it('renders font size inputs with limits 7 to 49 for all roles', () => {
    const state = createMockState();
    renderComponent(state);

    const sizeInputs = screen.getAllByRole('spinbutton');
    expect(sizeInputs).toHaveLength(6);

    for (const input of sizeInputs) {
      expect(input).toHaveAttribute('min', '7');
      expect(input).toHaveAttribute('max', '49');
    }
  });

  it('updates font size within 7 to 49 and enables Apply button', () => {
    const state = createMockState();
    const { updateSettings } = renderComponent(state);

    const sizeInputs = screen.getAllByRole('spinbutton');
    // Body font size input is at index 1
    fireEvent.change(sizeInputs[1], { target: { value: '24' } });

    const applyBtn = screen.getByRole('button', { name: new RegExp(t.fontApply) });
    expect(applyBtn).not.toBeDisabled();
    fireEvent.click(applyBtn);

    expect(screen.getByRole('dialog', { name: t.fontApplyConfirmTitle })).toBeInTheDocument();
    expect(screen.getByText(/24px/)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: new RegExp(t.fontApplyChanges) });
    fireEvent.click(confirmBtn);

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        fontBindings: expect.objectContaining({
          body: expect.objectContaining({ size: 24 }),
        }),
      }),
    );
  });

  it('clamps font size on blur to minimum 7 and maximum 49', () => {
    const state = createMockState();
    renderComponent(state);

    const sizeInputs = screen.getAllByRole('spinbutton');
    // Enter value exceeding max 49
    fireEvent.change(sizeInputs[0], { target: { value: '120' } });
    fireEvent.blur(sizeInputs[0]);
    expect(sizeInputs[0]).toHaveValue(49);

    // Enter value below min 7
    fireEvent.change(sizeInputs[0], { target: { value: '3' } });
    fireEvent.blur(sizeInputs[0]);
    expect(sizeInputs[0]).toHaveValue(7);
  });

  it('steps font size up and down with custom arrow buttons and displays tooltip', () => {
    const state = createMockState();
    renderComponent(state);

    const sizeInputs = screen.getAllByRole('spinbutton');
    const initialVal = Number((sizeInputs[0] as HTMLInputElement).value);

    const upButtons = screen.getAllByRole('button', { name: /\+/ });
    expect(upButtons).toHaveLength(6);
    fireEvent.click(upButtons[0]);
    expect(sizeInputs[0]).toHaveValue(initialVal + 1);

    const downButtons = screen.getAllByRole('button', { name: /-/ });
    expect(downButtons).toHaveLength(6);
    fireEvent.click(downButtons[0]);
    expect(sizeInputs[0]).toHaveValue(initialVal);

    const tooltipTexts = screen.getAllByText(new RegExp(`${t.fontSize} \\(7-49px\\)`));
    expect(tooltipTexts.length).toBeGreaterThanOrEqual(6);
  });
});
