// =============================================================================
// components/Modal/TermsModal.tsx - Terms of Service & Privacy Modal
// =============================================================================

import { useState, type MouseEvent } from "react";
import logoUrl from "../../assets/logos/logo-128.png";

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

  const legalLinkStyle = {
    color: "var(--accent-text)",
    fontWeight: 700,
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  };

  return (
    <div
      id="termsModal"
      className="mdn-modal"
      style={{
        display: "flex",
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "var(--modal-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="settings-card"
        style={{
          width: "680px",
          maxWidth: "min(94vw, 680px)",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
          background: "rgba(30, 30, 36, 0.45)",
          border: "1px solid var(--bd-s)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--sh-lg)",
          padding: "32px",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            margin: 0,
          }}
        >
          <img
            src={logoUrl}
            width="56"
            height="56"
            alt="Markdown Explorer Logo"
            style={{
              marginBottom: "12px",
              filter: "drop-shadow(0 4px 12px var(--accent-dim))",
            }}
          />
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: "var(--tx)",
              margin: 0,
            }}
          >
            Welcome to Markdown Explorer
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--tx2)",
              lineHeight: 1.6,
              marginTop: "8px",
              marginRight: 0,
              marginBottom: 0,
              marginLeft: 0,
            }}
          >
            Please review and accept our{" "}
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noreferrer"
              onClick={openExternal(PRIVACY_POLICY_URL)}
              style={legalLinkStyle}
            >
              Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href={TERMS_OF_SERVICE_URL}
              target="_blank"
              rel="noreferrer"
              onClick={openExternal(TERMS_OF_SERVICE_URL)}
              style={legalLinkStyle}
            >
              Terms of Service
            </a>{" "}
            to continue.
          </p>
        </div>

        {/* Checkbox and Agreement */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginTop: "4px",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              fontSize: "12px",
              userSelect: "none",
              color: "var(--tx)",
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              style={{
                marginTop: 0,
                width: "15px",
                height: "15px",
                flex: "0 0 15px",
                cursor: "pointer",
                accentColor: "var(--accent)",
              }}
            />
            <span style={{ lineHeight: "1.4" }}>
              I have read and agreed to the Privacy Policy and Terms of
              Service.
            </span>
          </label>

          {/* Action Button */}
          <button
            disabled={!checked}
            onClick={onAgree}
            className={`btn ${checked ? "btn--accent" : ""}`}
            style={{
              width: "100%",
              padding: "14px",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "var(--r-lg)",
              cursor: checked ? "pointer" : "not-allowed",
              background: checked ? "var(--accent)" : "var(--bg-e)",
              border: "none",
              color: checked ? "#ffffff" : "var(--txm)",
              boxShadow: checked
                ? "0 4px 12px var(--accent-dim)"
                : "none",
              transition: "all 0.15s ease",
              textAlign: "center",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
