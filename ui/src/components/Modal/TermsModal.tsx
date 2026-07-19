// =============================================================================
// components/Modal/TermsModal.tsx - Terms of Service & Privacy Modal
// =============================================================================

import { useState, type MouseEvent } from "react";
import logoUrl from "../../assets/logos/logo-500.png?inline";

interface TermsModalProps {
  isOpen: boolean;
  onAgree: () => void;
  onOpenExternal?: (url: string) => void;
}

const PRIVACY_POLICY_URL =
  "https://the-long-ride.github.io/markdown-explorer/privacy.html";
const TERMS_OF_SERVICE_URL =
  "https://the-long-ride.github.io/markdown-explorer/terms.html";

export function TermsModal({
  isOpen,
  onAgree,
  onOpenExternal,
}: TermsModalProps) {
  const [checked, setChecked] = useState(false);

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
            alt="Markdown Explorer Logo"
            className="terms-logo"
          />
          <h2>
            Welcome to Markdown Explorer
          </h2>
          <p>
            Please review and accept our{" "}
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noreferrer"
              onClick={openExternal(PRIVACY_POLICY_URL)}
              className="terms-link"
            >
              Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href={TERMS_OF_SERVICE_URL}
              target="_blank"
              rel="noreferrer"
              onClick={openExternal(TERMS_OF_SERVICE_URL)}
              className="terms-link"
            >
              Terms of Service
            </a>{" "}
            to continue.
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
            <span>
              I have read and agreed to the Privacy Policy and Terms of
              Service.
            </span>
          </label>

          {/* Action Button */}
          <button
            disabled={!checked}
            onClick={onAgree}
            className={`btn terms-continue${checked ? " is-enabled" : ""}`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
