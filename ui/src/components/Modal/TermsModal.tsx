// =============================================================================
// components/Modal/TermsModal.tsx - Terms of Service & Privacy Modal
// =============================================================================

import { useState, type MouseEvent } from "react";
import logoUrl from "../../assets/logos/logo-500.png?inline";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "../../constants/urls";
import { useAppState } from "../../contexts/AppStateContext";
import { getTranslations } from "../../contexts/translations";

interface TermsModalProps {
  isOpen: boolean;
  onAgree: () => void;
  onOpenExternal?: (url: string) => void;
}


export function TermsModal({
  isOpen,
  onAgree,
  onOpenExternal,
}: TermsModalProps) {
  const [checked, setChecked] = useState(false);
  const { state } = useAppState();
  const t = getTranslations(state.settings.language || "en");

  if (!isOpen) return null;

  const openExternal =
    (url: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (onOpenExternal) {
        onOpenExternal(url);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    };

  return (
    <div
      id="termsModal"
      className="mdn-modal"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="settings-card terms-card"
      >
        {/* Header */}
        <div className="terms-header">
          <img
            src={logoUrl}
            width="56"
            height="56"
            alt={t.terms.logoAlt}
            className="terms-logo"
          />
          <h2>{t.terms.welcomeTitle}</h2>
          <p>
            {t.terms.introBefore}{" "}
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noreferrer"
              onClick={openExternal(PRIVACY_POLICY_URL)}
              className="terms-link"
            >
              {t.terms.privacyPolicy}
            </a>{" "}
            {t.terms.conjunction}{" "}
            <a
              href={TERMS_OF_SERVICE_URL}
              target="_blank"
              rel="noreferrer"
              onClick={openExternal(TERMS_OF_SERVICE_URL)}
              className="terms-link"
            >
              {t.terms.termsOfService}
            </a>{" "}
            {t.terms.introAfter}
          </p>
        </div>

        {/* Checkbox and Agreement */}
        <div className="terms-agreement">
          <label className="terms-checkbox-label">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="terms-checkbox"
            />
            <span>{t.terms.agreement}</span>
          </label>

          {/* Action Button */}
          <button
            disabled={!checked}
            onClick={onAgree}
            className={`btn terms-continue${checked ? " is-enabled" : ""}`}
          >
            {t.terms.continue}
          </button>
        </div>
      </div>
    </div>
  );
}
