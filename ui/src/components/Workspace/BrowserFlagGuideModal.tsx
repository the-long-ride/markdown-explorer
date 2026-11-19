import { useEffect } from 'react';

export interface BrowserFlagGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: any;
}

export function BrowserFlagGuideModal({ isOpen, onClose, t }: BrowserFlagGuideModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const wsT = t?.workspaceSelection ?? {};
  const tooltipsT = t?.tooltips ?? {};

  return (
    <div
      className="modal-overlay browser-flag-guide-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="browser-flag-guide-title"
      data-testid="browser-flag-guide-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-card browser-flag-guide-card">
        <button
          type="button"
          className="settings-card__close"
          onClick={onClose}
          aria-label={tooltipsT.close ?? 'Close'}
        >
          &times;
        </button>
        <div className="workspace-selection__guide-title" id="browser-flag-guide-title">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>{wsT.browserConfigTitle ?? 'Browser configuration required'}</span>
        </div>
        <p className="workspace-selection__guide-copy browser-flag-guide-copy">
          {wsT.browserConfigIntro}
        </p>
        <div className="workspace-selection__guide-list browser-flag-guide-list">
          <div>
            1. {wsT.browserConfigOpen} <code>chrome://flags</code> {wsT.browserConfigOr} <code>brave://flags</code>
          </div>
          <div>
            2. {wsT.browserConfigSearch} <strong>File System Access API</strong>
          </div>
          <div>
            3. {wsT.browserConfigEnable}
          </div>
        </div>
      </div>
    </div>
  );
}
