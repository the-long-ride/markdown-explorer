// =============================================================================
// components/Content/WelcomePage.tsx — Common Welcome & Guidelines Screen
// =============================================================================

export function WelcomePage() {
  const isElectron = typeof (window as any).electronAPI !== 'undefined';

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
          Welcome to Markdown Explorer
        </h1>
        <p style={{ fontSize: '1.15em', color: 'var(--tx2)', marginBottom: '12px', lineHeight: '1.5' }}>
          A premium, local-first documentation viewer and navigator for{' '}
          {isElectron ? 'Desktop.' : 'Visual Studio Code.'}
        </p>
        <div style={{ fontSize: '0.95em', color: 'var(--tx2)' }}>
          Created by{' '}
          <a
            href="https://github.com/the-long-ride"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600 }}
          >
            the-long-ride
          </a>{' '}
          with ❤️ · Repository:{' '}
          <a
            href="https://github.com/the-long-ride/markdown-explorer"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600 }}
          >
            markdown-explorer
          </a>{' '}
          · License:{' '}
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
          <span>🔒 100% Private, Offline-First & Independent</span>
        </div>
        <div style={{ fontSize: '12.5px', lineHeight: '1.6', color: 'var(--tx2)' }}>
          We believe your documentation should be kept completely private.{' '}
          <strong>Markdown Explorer</strong> operates entirely on your local machine:
          <ul style={{ margin: '8px 0 0 20px', padding: 0, listStyleType: 'disc' }}>
            <li style={{ marginBottom: '4px' }}>
              <strong>No Tracking & Telemetry</strong>: We do not collect or send any usage data, analytics, or keystrokes.
            </li>
            <li style={{ marginBottom: '4px' }}>
              <strong>No External Libraries</strong>: This {isElectron ? 'app' : 'extension'} does not package or load any third-party external trackers, analytic scripts, or telemetry libraries.
            </li>
            <li style={{ marginBottom: 0 }}>
              <strong>100% Offline Support</strong>: All markdown parsing, scanning, rendering, and quick search indexing are executed locally with zero remote dependencies.
            </li>
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
          How to Use All Features
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          {/* Feature 1 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>📁 Workspace Navigation Tree</div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              The left sidebar displays an interactive folder structure scanning all markdown files in your workspace. Simply click any file to open it in preview mode. You can filter files by name using the search bar at the top of the sidebar.
            </div>
          </div>

          {/* Feature 2 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>
              🔍 Instant Quick Search ({isElectron ? <kbd>Ctrl+K</kbd> : <><kbd>Ctrl+K</kbd> (or <kbd>Cmd+K</kbd> on Mac)</>})
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              Press {isElectron ? <kbd>Ctrl+K</kbd> : <><kbd>Ctrl+K</kbd> (or <kbd>Cmd+K</kbd> on Mac)</>} from anywhere in the preview window to open the quick search overlay. Type a query to search across all markdown file names instantly. Use the mouse or keyboard to select and open a file.
            </div>
          </div>

          {/* Feature 3 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>📋 Excel-Style Interactive Data Tables</div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              Standard markdown tables are automatically converted to interactive tables. You can sort columns by clicking their headers, use the funnel icon on headers to filter rows by values, and type inside the search bar above the table to search row contents.
            </div>
          </div>

          {/* Feature 4 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>📊 One-Click Table-to-Chart Switcher</div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              For tables containing numeric columns, a view switcher will appear. Click the <strong>Bar</strong>, <strong>Line</strong>, or <strong>Pie</strong> buttons to instantly visualize the table data as an interactive Chart.js chart.
            </div>
          </div>

          {/* Feature 5 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>🎨 Syntax Highlighting & Mermaid Diagrams</div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              Enjoy high-contrast, premium syntax highlighting for code blocks (TypeScript, JavaScript, etc.) with custom overrides for comments and optional properties. Mermaid sequence, flowchart, and class diagrams render natively on the client with 100% strict offline containment.
            </div>
          </div>

          {/* Feature 6 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>🖼️ Zoomable Backdrop Media Modal</div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              Click any image or diagram within your documents to launch a premium backdrop-blur modal. You can scroll to zoom in/out, click and drag to pan across high-res graphics, or use the arrow keys to cycle through all images in the document.
            </div>
          </div>

          {/* Feature 7 */}
          <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-text)', marginBottom: '6px' }}>⌨️ Keyboard Shortcuts & Navigation</div>
            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx2)' }}>
              {!isElectron && (
                <div style={{ marginBottom: '8px' }}>
                  Use <kbd>Ctrl+Shift+M</kbd> (<kbd>Cmd+Shift+M</kbd> on Mac) to open Markdown Explorer, and <kbd>Ctrl+Alt+V</kbd> (<kbd>Cmd+Alt+V</kbd> on Mac) or click the editor title button to quickly toggle the Markdown Explorer view on a markdown file.
                </div>
              )}
              Control and navigate your documentation easily using standard and customizable keyboard shortcuts:
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '11.5px', color: 'var(--tx2)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bd-s)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px 6px 0', fontWeight: 600 }}>Action</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600 }}>Default Shortcut</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>Back to previous file</td>
                    <td style={{ padding: '4px 8px' }}>
                      {isElectron ? <kbd>Ctrl+&larr;</kbd> : <><kbd>Ctrl+&larr;</kbd> (or <kbd>Cmd+&larr;</kbd>)</>} or Mouse Back button
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>Go to next file</td>
                    <td style={{ padding: '4px 8px' }}>
                      {isElectron ? <kbd>Ctrl+&rarr;</kbd> : <><kbd>Ctrl+&rarr;</kbd> (or <kbd>Cmd+&rarr;</kbd>)</>} or Mouse Forward button
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>Go to welcome page</td>
                    <td style={{ padding: '4px 8px' }}><kbd>Ctrl+H</kbd></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>Open settings modal</td>
                    <td style={{ padding: '4px 8px' }}><kbd>Ctrl+I</kbd></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>Toggle light/dark mode</td>
                    <td style={{ padding: '4px 8px' }}><kbd>Ctrl+Shift+L</kbd></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 8px 4px 0' }}>Zoom in/out image (in image modal)</td>
                    <td style={{ padding: '4px 8px' }}><kbd>Scroll Mouse Wheel</kbd></td>
                  </tr>
                  {isElectron && (
                    <>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>Refresh current file</td>
                        <td style={{ padding: '4px 8px' }}><kbd>F5</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>Collapse all heading groups</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl+Shift+X</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>Expand all heading groups</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl+Shift+E</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>Go to workspace selection page</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl+Shift+H</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>Toggle sidebar</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl+Shift+P</kbd></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 8px 4px 0' }}>Zoom in</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl + =</kbd> (or <kbd>Ctrl + +</kbd>) or <kbd>Ctrl + Wheel Up</kbd></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 8px 4px 0' }}>Zoom out</td>
                        <td style={{ padding: '4px 8px' }}><kbd>Ctrl + -</kbd> or <kbd>Ctrl + Wheel Down</kbd></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              <div style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
                Note: You can change all keyboard shortcuts from the **Settings Modal** (click settings button or press <kbd>Ctrl+I</kbd>).
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
          🐞 Report Issues & Get Help
        </h2>

        <div style={{ background: 'var(--bg-s)', border: '1px solid var(--bd-s)', borderRadius: 'var(--r-lg)', padding: '12px 16px', fontSize: '12px', color: 'var(--tx2)' }}>
          <p style={{ marginTop: 0, marginBottom: 8 }}>
            Before opening a new issue, please check the repository Issues page to avoid duplicates:
            {' '}
            <a href="https://github.com/the-long-ride/markdown-explorer/issues" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>Repository Issues</a>
          </p>
          <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
            <li>Search existing issues first to see if someone already reported it.</li>
            <li>Include steps to reproduce, your OS, and whether you use the VS Code extension or Desktop app.</li>
            <li>Attach a small sample markdown file or screenshot and any console errors if available.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
