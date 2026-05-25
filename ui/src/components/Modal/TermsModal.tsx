// =============================================================================
// components/Modal/TermsModal.tsx — Terms of Service & License Modal
// =============================================================================

import { useState } from "react";
import logoUrl from "../../assets/logos/logo-128.png";

interface TermsModalProps {
  isOpen: boolean;
  onAgree: () => void;
}

export function TermsModal({ isOpen, onAgree }: TermsModalProps) {
  const [checked, setChecked] = useState(false);

  if (!isOpen) return null;

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
          width: "1080px",
          maxWidth: "90%",
          maxHeight: "65vh",
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          background: "rgba(30, 30, 36, 0.45)",
          border: "1px solid var(--bd-s)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--sh-lg)",
          padding: "32px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            borderBottom: "1px solid var(--bd)",
            paddingBottom: "20px",
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
              filter: "drop-shadow(0 4px 12px rgba(139, 124, 248, 0.2))",
            }}
          />
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: "var(--tx)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Welcome to Markdown Explorer
          </h2>
          <p
            style={{
              fontSize: "12px",
              color: "var(--tx2)",
              marginTop: "4px",
              marginRight: 0,
              marginBottom: 0,
              marginLeft: 0,
            }}
          >
            Please review and accept our Terms of Service to continue.
          </p>
        </div>

        {/* Terms Content Scroll Box */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            background: "var(--bg-code)",
            border: "1px solid var(--bd)",
            borderRadius: "var(--r-md)",
            padding: "16px 20px",
            fontSize: "12px",
            lineHeight: "1.6",
            color: "var(--tx2)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* MIT License Section */}
          <div>
            <h4
              style={{
                color: "var(--tx)",
                fontWeight: 700,
                marginBottom: "6px",
                fontSize: "13px",
              }}
            >
              1. MIT License & Open Source
            </h4>
            <p>
              Markdown Explorer is open-source software licensed under the{" "}
              <strong>MIT License</strong>. Permission is hereby granted, free
              of charge, to any person obtaining a copy of this software and
              associated documentation files to deal in the software without
              restriction.
            </p>
          </div>

          {/* Privacy Section */}
          <div>
            <h4
              style={{
                color: "var(--tx)",
                fontWeight: 700,
                marginBottom: "6px",
                fontSize: "13px",
              }}
            >
              2. Privacy & Offline-First Pledge
            </h4>
            <p style={{ marginBottom: "6px" }}>
              We value your privacy. This application is engineered to operate{" "}
              <strong>entirely locally</strong> on your machine:
            </p>
            <ul
              style={{
                paddingLeft: "16px",
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <li>
                <strong>No Tracking & Telemetry:</strong> We do not track,
                collect, or transmit any usage statistics, personal data,
                analytics, or search queries.
              </li>
              <li>
                <strong>No Cloud Dependencies:</strong> All file scanning,
                markdown parsing, syntax highlighting, and table/chart
                conversions are executed purely locally with zero remote server
                connections.
              </li>
            </ul>
          </div>

          {/* Data Section */}
          <div>
            <h4
              style={{
                color: "var(--tx)",
                fontWeight: 700,
                marginBottom: "6px",
                fontSize: "13px",
              }}
            >
              3. Your Workspace Data
            </h4>
            <p>
              Any workspace folders or files you choose to open in this
              application remain completely under your control on your local
              storage. The application does not sync, transfer, or upload your
              data to any cloud storage or third-party platforms.
            </p>
          </div>

          {/* Disclaimer of Warranty Section */}
          <div
            style={{
              borderTop: "1px dashed var(--bd-s)",
              paddingTop: "12px",
            }}
          >
            <h4
              style={{
                color: "var(--danger)",
                fontWeight: 700,
                marginBottom: "6px",
                fontSize: "13px",
              }}
            >
              4. Disclaimer of Warranty
            </h4>
            <p style={{ fontStyle: "italic", fontWeight: 500 }}>
              THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
              NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
              HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
              WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
              OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
              DEALINGS IN THE SOFTWARE.
            </p>
          </div>
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
              alignItems: "flex-start",
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
                marginTop: "3px",
                width: "15px",
                height: "15px",
                cursor: "pointer",
                accentColor: "var(--accent)",
              }}
            />
            <span style={{ lineHeight: "1.4" }}>
              I have read and agree to the Terms of Service, MIT License, and
              offline-first privacy policy.
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
                ? "0 4px 12px rgba(139, 124, 248, 0.25)"
                : "none",
              transition: "all 0.15s ease",
              textAlign: "center",
            }}
          >
            Agree & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
