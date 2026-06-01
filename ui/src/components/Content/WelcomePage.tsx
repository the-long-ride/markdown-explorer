// =============================================================================
// components/Content/WelcomePage.tsx — Common Welcome & Guidelines Screen
// =============================================================================

import { useAppState } from '../../contexts/AppStateContext';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';

export function WelcomePage() {
  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const { state } = useAppState();
  const currentLang = state.settings.language || 'en';
  const wt = getWelcomeTranslations(currentLang);

  return (
    <div
      className="welcome-container"
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px 10px',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '2.2em',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '8px',
            color: 'var(--tx)',
          }}
        >
          {wt.hero.title}
        </h1>
        <p style={{ fontSize: '1.15em', color: 'var(--tx2)', marginBottom: '12px', lineHeight: '1.5' }}>
          {isElectron ? wt.hero.descDesktop : wt.hero.descVSCode}
        </p>
        <div style={{ fontSize: '0.95em', color: 'var(--tx2)' }}>
          {wt.hero.createdBy}{' '}
          <a
            href="https://github.com/the-long-ride"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600 }}
          >
            the-long-ride
          </a>{' '}
          with ❤️ · {wt.hero.repository}:{' '}
          <a
            href="https://github.com/the-long-ride/markdown-explorer"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600 }}
          >
            markdown-explorer
          </a>{' '}
          · {wt.hero.license}:{' '}
          <a
            href="https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600 }}
          >
            MIT
          </a>
        </div>
      </div>

      {/* Privacy Pledge */}
      <div
        style={{
          background: 'rgba(52, 211, 153, 0.07)',
          border: '1px solid rgba(52, 211, 153, 0.35)',
          borderRadius: 'var(--r-lg)',
          padding: '16px 20px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700,
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--success)',
            marginBottom: '8px',
          }}
        >
          <span>{wt.privacy.title}</span>
        </div>
        <div style={{ fontSize: '12.5px', lineHeight: '1.6', color: 'var(--tx2)' }}>
          {wt.privacy.desc}
          <ul style={{ margin: '8px 0 0 20px', padding: 0, listStyleType: 'disc' }}>
            {wt.privacy.bullets.map((bullet, idx) => (
              <li key={idx} style={{ marginBottom: idx === wt.privacy.bullets.length - 1 ? 0 : '4px' }}>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Feature Guidelines */}
      <div style={{ marginBottom: '32px' }}>
        <h2
          style={{
            fontSize: '1.4em',
            fontWeight: 700,
            marginBottom: '16px',
            borderBottom: '1px solid var(--bd-s)',
            paddingBottom: '6px',
            color: 'var(--tx)',
          }}
        >
          {wt.features.title}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          {/* Feature 1 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>
              {wt.features.tree.title}
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              {wt.features.tree.desc}
            </div>
          </div>

          {/* Feature 2 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>
              {wt.features.search.title} ({isElectron ? <kbd>Ctrl+F</kbd> : <><kbd>Ctrl+K</kbd> (or <kbd>Cmd+K</kbd> on Mac)</>})
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              {wt.features.search.desc}
            </div>
          </div>

          {/* Feature 3 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>
              {wt.features.tables.title}
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              {wt.features.tables.desc}
            </div>
          </div>

          {/* Feature 4 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>
              {wt.features.charts.title}
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              {wt.features.charts.desc}
            </div>
          </div>

          {/* Feature 5 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>
              {wt.features.highlight.title}
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              {wt.features.highlight.desc}
            </div>
          </div>

          {/* Feature 6 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>
              {wt.features.modal.title}
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              {wt.features.modal.desc}
            </div>
          </div>

          {/* Feature 7 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>
              {wt.features.shortcuts.title}
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              {!isElectron && (
                <div style={{ marginBottom: '8px' }}>
                  {wt.features.shortcuts.vscodeDesc}
                </div>
              )}
              {wt.features.shortcuts.desc}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '11.5px', color: 'var(--tx2)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bd-s)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px 6px 0', fontWeight: 600 }}>{wt.shortcutsTable.headers.action}</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600 }}>{wt.shortcutsTable.headers.shortcut}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.back}</td>
                    <td style={{ padding: '4px 8px' }}>
                      {isElectron ? <kbd>Ctrl+&larr;</kbd> : <><kbd>Ctrl+&larr;</kbd> (or <kbd>Cmd+&larr;</kbd>)</>}{' '}
                      {wt.shortcutsTable.rows.backShortcut}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.forward}</td>
                    <td style={{ padding: '4px 8px' }}>
                      {isElectron ? <kbd>Ctrl+&rarr;</kbd> : <><kbd>Ctrl+&rarr;</kbd> (or <kbd>Cmd+&rarr;</kbd>)</>}{' '}
                      {wt.shortcutsTable.rows.forwardShortcut}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.welcome}</td>
                    <td style={{ padding: '4px 8px' }}><kbd>Ctrl+H</kbd></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.settings}</td>
                    <td style={{ padding: '4px 8px' }}><kbd>Ctrl+I</kbd></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.theme}</td>
                    <td style={{ padding: '4px 8px' }}><kbd>{isElectron ? 'Ctrl+L' : 'Ctrl+Shift+L'}</kbd></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.zoomModal}</td>
                    <td style={{ padding: '4px 8px' }}><kbd>{wt.shortcutsTable.rows.zoomModalShortcut}</kbd></td>
                  </tr>
                  {isElectron && (
                    <>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.refresh}</td>
                        <td style={{ padding: '4px 8px' }}><kbd>F5</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.collapse}</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl+Shift+X</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.expand}</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl+Shift+E</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.workspace}</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl+Shift+H</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.sidebar}</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl+Shift+P</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.zoomIn}</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl + =</kbd> (<kbd>Ctrl + +</kbd>) {wt.shortcutsTable.rows.zoomInShortcut}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 8px 4px 0' }}>{wt.shortcutsTable.rows.zoomOut}</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl + -</kbd> {wt.shortcutsTable.rows.zoomOutShortcut}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              <div style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
                {wt.shortcutsTable.note}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Issues */}
      <div style={{ marginBottom: '32px' }}>
        <h2
          style={{
            fontSize: '1.2em',
            fontWeight: 700,
            marginBottom: '10px',
            color: 'var(--tx)',
          }}
        >
          {wt.issues.title}
        </h2>

        <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '12px 16px', fontSize: '12px', color: 'var(--tx2)' }}>
          <p style={{ marginTop: 0, marginBottom: 8 }}>
            {wt.issues.hint}
            {' '}
            <a href="https://github.com/the-long-ride/markdown-explorer/issues" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
              {wt.issues.linkText}
            </a>
          </p>
          <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
            {wt.issues.bullets.map((bullet, idx) => (
              <li key={idx}>{bullet}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
