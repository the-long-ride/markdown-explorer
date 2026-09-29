// =============================================================================
// components/Modal/SupportPromptModal.tsx — Community Support & Appreciation modal
// =============================================================================

import { useLayoutEffect, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { getSupportPromptTranslations } from '../../contexts/supportPromptTranslations';
import { StarIcon } from '../shared/icons';
import { HeartIcon } from '../shared/HeartIcon';
import './SupportPromptModal.css';

export interface SupportPromptModalProps {
  isOpen: boolean;
  onClose: (neverShowAgain: boolean) => void;
  onStar?: (neverShowAgain: boolean) => void;
  onDonate?: (neverShowAgain: boolean) => void;
}

function CheckboxCheckedIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="21" y="3" width="18" height="18" rx="1" transform="rotate(90 21 3)" />
      <path d="M6.66666 12.6667L9.99999 16L17.3333 8.66669" />
    </svg>
  );
}

function CheckboxUncheckedIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path fill="none" d="M0 0h24v24H0z" />
      <path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v14h14V5H5z" />
    </svg>
  );
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
