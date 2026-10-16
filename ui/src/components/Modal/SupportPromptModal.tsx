// =============================================================================
// components/Modal/SupportPromptModal.tsx — Community Support & Appreciation modal
// =============================================================================

import { useLayoutEffect, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { getSupportPromptTranslations } from '../../contexts/supportPromptTranslations';
import { StarIcon } from '../shared/icons';
import { CheckboxCheckedIcon, CheckboxUncheckedIcon } from '../shared/CheckboxIcons';
import { HeartIcon } from '../shared/HeartIcon';
import './SupportPromptModal.css';

export interface SupportPromptModalProps {
  isOpen: boolean;
  onClose: (neverShowAgain: boolean) => void;
  onStar?: (neverShowAgain: boolean) => void;
  onDonate?: (neverShowAgain: boolean) => void;
}

export function SupportPromptModal({ isOpen, onClose, onStar, onDonate }: SupportPromptModalProps) {
  const { state } = useAppState();
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  const t = getSupportPromptTranslations(state?.settings?.language);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(neverShowAgain);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, neverShowAgain, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="mdn-modal support-prompt-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-prompt-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose(neverShowAgain);
        }
      }}
    >
      <div className="settings-card support-prompt-card">
        <button
          type="button"
          className="settings-card__close support-prompt-card__close"
          onClick={() => onClose(neverShowAgain)}
          aria-label={t.close}
        >
          &times;
        </button>

        <div className="support-prompt-card__header">
          <div className="support-prompt-card__icon" aria-hidden="true">
            <HeartIcon size={20} />
          </div>
          <h2 id="support-prompt-title" className="support-prompt-card__title">
            {t.title}
          </h2>
          <p className="support-prompt-card__message">{t.message}</p>
        </div>

        <div className="support-prompt-card__options">
          {onStar && (
            <section className="support-prompt-option support-prompt-option--star" aria-labelledby="support-prompt-star-title">
              <div className="support-prompt-option__icon" aria-hidden="true">
                <StarIcon size={14} />
              </div>
              <h3 id="support-prompt-star-title" className="support-prompt-option__title">{t.starTitle}</h3>
              <p className="support-prompt-option__desc">{t.starDesc}</p>
              <button
                type="button"
                className="support-prompt-card__star-btn"
                onClick={() => onStar(neverShowAgain)}
              >
                <StarIcon size={13} className="support-prompt-card__btn-icon" />
                <span>{t.starButton}</span>
              </button>
            </section>
          )}
          {onDonate && (
            <section className="support-prompt-option support-prompt-option--donate" aria-labelledby="support-prompt-donate-title">
              <div className="support-prompt-option__icon" aria-hidden="true">
                <HeartIcon size={14} />
              </div>
              <h3 id="support-prompt-donate-title" className="support-prompt-option__title">{t.donateTitle}</h3>
              <p className="support-prompt-option__desc">{t.donateDesc}</p>
              <button
                type="button"
                className="support-prompt-card__donate-btn"
                onClick={() => onDonate(neverShowAgain)}
              >
                <HeartIcon size={13} className="support-prompt-card__btn-icon" />
                <span>{t.donateButton}</span>
              </button>
            </section>
          )}
        </div>

        <p className="support-prompt-card__thanks">{t.thanks}</p>

        <div className="support-prompt-card__actions">
          <label className="support-prompt-card__checkbox-label">
            <input
              type="checkbox"
              className="support-prompt-card__checkbox"
              checked={neverShowAgain}
              onChange={(e) => setNeverShowAgain(e.target.checked)}
            />
            <span className="support-prompt-card__checkbox-custom" aria-hidden="true">
              {neverShowAgain ? (
                <CheckboxCheckedIcon size={18} />
              ) : (
                <CheckboxUncheckedIcon size={18} />
              )}
            </span>
            <span className="support-prompt-card__checkbox-text">{t.dontShowAgain}</span>
          </label>
          <button
            type="button"
            className="support-prompt-card__later-btn"
            onClick={() => onClose(neverShowAgain)}
          >
            {t.maybeLater}
          </button>
        </div>
      </div>
    </div>
  );
}
