import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AppSettings } from '../../types';
import type { AppState } from '../../contexts/appStateReducer';
import type { Translations } from '../../contexts/translationTypes';
import { usePlatform } from '../../contexts/PlatformContext';
import {
  DEFAULT_DESKTOP_FONT_BINDINGS,
  findDesktopFontFamily,
  getDesktopFontVariantOptions,
  migrateDesktopFontBindings,
  type DesktopFontBinding,
  type DesktopFontBindings,
  type DesktopFontSelection,
  type DesktopFontUsageRole,
} from '../../desktop/fonts/fontModel';
import { ImportSettingsIcon, RefreshIcon, TypographyApplyIcon } from '../shared/icons';
import { SettingsOutlineButton } from './SettingsOutlineButton';
import { FontSearchDropdown } from './FontSearchDropdown';
import { FontVariantDropdown } from './FontVariantDropdown';
import { desktopTypographyBindingsEqual, getDesktopTypographyChanges, type DesktopTypographyChangeValue } from './desktopTypographyChanges';

function createRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const ROLE_LABELS: Record<DesktopFontUsageRole, keyof Pick<Translations, 'appUiFont' | 'bodyFont' | 'headingFont' | 'quoteFont' | 'codeFont'>> = {
  appUi: 'appUiFont', body: 'bodyFont', heading: 'headingFont', quote: 'quoteFont', code: 'codeFont',
};

function formatTypographyChangeValue(value: DesktopTypographyChangeValue, t: Translations): string {
  const style = value.style === 'italic' ? t.fontItalic : t.fontNormal;
  return `${value.family} · ${style} ${value.weight}`;
}

function chooseFamily(
  role: DesktopFontUsageRole,
  current: DesktopFontBinding,
  selection: DesktopFontSelection,
  fonts: AppState['desktopFonts'],
): DesktopFontBinding {
  if (selection.source === 'default') return { ...DEFAULT_DESKTOP_FONT_BINDINGS[role] };
  const family = findDesktopFontFamily(selection, fonts);
  const variants = getDesktopFontVariantOptions(family);
  const sameVariant = variants.find((option) => option.style === current.style && option.weight === current.weight);
  const preferred = sameVariant ?? variants.find((option) => option.style === 'normal' && option.weight === 400) ?? variants[0];
  return {
    ...selection,
    style: preferred?.style ?? DEFAULT_DESKTOP_FONT_BINDINGS[role].style,
    weight: preferred?.weight ?? DEFAULT_DESKTOP_FONT_BINDINGS[role].weight,
  };
}

function resetBindingsUsingImport(bindings: DesktopFontBindings, id: string): DesktopFontBindings {
  return Object.fromEntries(Object.entries(bindings).map(([role, binding]) => [
    role,
    binding.source === 'imported' && binding.id === id
      ? { ...DEFAULT_DESKTOP_FONT_BINDINGS[role as DesktopFontUsageRole] }
      : binding,
  ])) as unknown as DesktopFontBindings;
}

function FontRoleRow({
  role,
  binding,
  fonts,
  t,
  onChange,
  onImport,
  onRemove,
}: {
  role: DesktopFontUsageRole;
  binding: DesktopFontBinding;
  fonts: AppState['desktopFonts'];
  t: Translations;
  onChange: (binding: DesktopFontBinding) => void;
  onImport: () => void;
  onRemove: (id: string) => void;
}) {
  const family = findDesktopFontFamily(binding, fonts);
  return (
    <section className="desktop-font-binding-row">
      <div className="desktop-font-binding-row__heading">
        <div>
          <div className="settings-item__title">{t[ROLE_LABELS[role]]}</div>
          <div className="settings-item__desc">{family?.family ?? t.fontDefaultDescription}</div>
        </div>
        <div className="desktop-font-binding-row__header-actions">
          <SettingsOutlineButton
            type="button"
            className="desktop-font-binding-row__import"
            label={t.fontImport}
            tooltip={t.fontImport}
            icon={<ImportSettingsIcon size={13} />}
            onClick={onImport}
          />
          <SettingsOutlineButton
            type="button"
            className="desktop-font-binding-row__reset"
            tooltip={t.fontResetRole}
            tooltipAlign="right"
            iconOnly
            icon={<RefreshIcon size={13} />}
            onClick={() => onChange({ ...DEFAULT_DESKTOP_FONT_BINDINGS[role] })}
          />
        </div>
      </div>
      <div className="desktop-font-binding-row__controls">
        <FontSearchDropdown
          value={binding}
          fonts={fonts}
          t={t}
          onChange={(selection) => onChange(chooseFamily(role, binding, selection, fonts))}
        />
        <FontVariantDropdown
          family={family}
          value={binding}
          t={t}
          onChange={(variant) => onChange({ ...binding, ...variant })}
        />
      </div>
      {family?.source === 'imported' && (
        <div className="desktop-font-binding-row__actions">
          <SettingsOutlineButton
            type="button"
            label={t.fontRemove}
            tooltip={t.fontRemove}
            onClick={() => onRemove(family.id)}
          />
        </div>
      )}
    </section>
  );
}

export function DesktopTypographySettings({
  state,
  t,
  updateSettings,
}: {
  state: AppState;
  t: Translations;
  updateSettings: (patch: Partial<AppSettings>) => void;
}) {
  const bridge = usePlatform();
  const savedBindings = useMemo(() => migrateDesktopFontBindings(state.settings.fontBindings), [state.settings.fontBindings]);
  const [draft, setDraft] = useState<DesktopFontBindings>(savedBindings);
  const [pendingImport, setPendingImport] = useState<{ requestId: string; role: DesktopFontUsageRole } | null>(null);
  const [fontApplyConfirmOpen, setFontApplyConfirmOpen] = useState(false);

  useEffect(() => {
    setDraft(savedBindings);
    setFontApplyConfirmOpen(false);
  }, [savedBindings]);

  useEffect(() => {
    const result = state.desktopFontsResult;
    if (!pendingImport || !result || result.requestId !== pendingImport.requestId) return;

    if (result.importedId) {
      const importedFamily = state.desktopFonts.find((font) => font.source === 'imported' && font.id === result.importedId);
      if (importedFamily) {
        const selection: DesktopFontSelection = {
          source: 'imported',
          family: importedFamily.family,
          id: importedFamily.id,
        };
        setDraft((current) => ({
          ...current,
          [pendingImport.role]: chooseFamily(pendingImport.role, current[pendingImport.role], selection, state.desktopFonts),
        }));
      }
    }

    setPendingImport(null);
  }, [pendingImport, state.desktopFonts, state.desktopFontsResult]);

  const changed = !desktopTypographyBindingsEqual(savedBindings, draft);
  const typographyChanges = useMemo(
    () => getDesktopTypographyChanges(savedBindings, draft, state.desktopFonts, t.fontDefault),
    [draft, savedBindings, state.desktopFonts, t.fontDefault],
  );
  const setRole = (role: DesktopFontUsageRole, binding: DesktopFontBinding) => setDraft((current) => ({ ...current, [role]: binding }));
  const importFont = (role: DesktopFontUsageRole) => {
    const requestId = createRequestId(`import-font-${role}`);
    setPendingImport({ requestId, role });
    bridge.postMessage({ command: 'importDesktopFonts', requestId });
  };
  const removeImported = (id: string) => {
    const nextDraft = resetBindingsUsingImport(draft, id);
    const nextSaved = resetBindingsUsingImport(savedBindings, id);
    setDraft(nextDraft);
    if (JSON.stringify(nextSaved) !== JSON.stringify(savedBindings)) {
      updateSettings({ fontBindings: nextSaved });
    }
    bridge.postMessage({ command: 'removeImportedDesktopFont', requestId: createRequestId('remove-font'), id });
  };

  const cancelApply = () => setFontApplyConfirmOpen(false);
  const confirmApply = () => {
    updateSettings({ fontBindings: draft });
    setFontApplyConfirmOpen(false);
  };

  return (
    <>
      <div className="settings-field--separated desktop-typography-settings">
        <div className="settings-section-panel__header desktop-typography-settings__header">
          <div>
            <h3>{t.typography}</h3>
            <p>{t.typographyDesc}</p>
          </div>
          <button
            type="button"
            className="banned-shortcut-close-btn desktop-typography-settings__apply"
            disabled={!changed}
            onClick={() => setFontApplyConfirmOpen(true)}
          >
            <TypographyApplyIcon className="desktop-typography-action-icon" size={14} />
            <span>{t.fontApply}</span>
          </button>
        </div>
        <div className="desktop-typography-settings__scroll">
          <div className="desktop-font-bindings">
            <FontRoleRow role="appUi" binding={draft.appUi} fonts={state.desktopFonts} t={t} onChange={(binding) => setRole('appUi', binding)} onImport={() => importFont('appUi')} onRemove={removeImported} />
            <FontRoleRow role="body" binding={draft.body} fonts={state.desktopFonts} t={t} onChange={(binding) => setRole('body', binding)} onImport={() => importFont('body')} onRemove={removeImported} />
            <FontRoleRow role="heading" binding={draft.heading} fonts={state.desktopFonts} t={t} onChange={(binding) => setRole('heading', binding)} onImport={() => importFont('heading')} onRemove={removeImported} />
            <FontRoleRow role="quote" binding={draft.quote} fonts={state.desktopFonts} t={t} onChange={(binding) => setRole('quote', binding)} onImport={() => importFont('quote')} onRemove={removeImported} />
            <FontRoleRow role="code" binding={draft.code} fonts={state.desktopFonts} t={t} onChange={(binding) => setRole('code', binding)} onImport={() => importFont('code')} onRemove={removeImported} />
          </div>
          {state.desktopFontError && <div className="settings-item__desc desktop-typography-settings__error" role="status">{state.desktopFontError}</div>}
        </div>
      </div>
      {fontApplyConfirmOpen && changed && typeof document !== 'undefined' && createPortal(
        <div
          className="mdn-modal settings-modal-dialog desktop-typography-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="desktop-typography-confirm-title"
          onClick={(event) => { if (event.target === event.currentTarget) cancelApply(); }}
        >
          <div className="settings-card desktop-typography-confirm-dialog">
            <button type="button" className="settings-card__close" onClick={cancelApply} aria-label={t.cancelResetShortcuts}>&times;</button>
            <div className="desktop-typography-confirm-dialog__header">
              <div className="desktop-typography-confirm-dialog__icon"><TypographyApplyIcon size={30} /></div>
              <div>
                <h3 id="desktop-typography-confirm-title">{t.fontApplyConfirmTitle}</h3>
                <p>{t.fontApplyConfirmBody}</p>
              </div>
            </div>
            <div className="desktop-typography-confirm-dialog__changes">
              {typographyChanges.map((change) => (
                <div className="desktop-typography-confirm-dialog__change" key={change.role}>
                  <div className="desktop-typography-confirm-dialog__role">{t[ROLE_LABELS[change.role]]}</div>
                  <div className="desktop-typography-confirm-dialog__values">
                    <span>{formatTypographyChangeValue(change.before, t)}</span>
                    <span className="desktop-typography-confirm-dialog__arrow" aria-hidden="true">→</span>
                    <strong>{formatTypographyChangeValue(change.after, t)}</strong>
                  </div>
                </div>
              ))}
            </div>
            <div className="desktop-typography-confirm-dialog__actions">
              <SettingsOutlineButton type="button" label={t.cancelResetShortcuts} onClick={cancelApply} />
              <button type="button" className="banned-shortcut-close-btn desktop-typography-confirm-dialog__apply" onClick={confirmApply}>
                <TypographyApplyIcon className="desktop-typography-action-icon" size={14} />
                <span>{t.fontApplyChanges}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
