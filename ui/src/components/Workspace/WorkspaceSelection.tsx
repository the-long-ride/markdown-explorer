import { useState, /* useRef, useEffect */ } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { FolderIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import logoUrl from '../../assets/logos/logo-128.png';

function formatLastOpened(timestamp?: number) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function WorkspaceSelection() {
  const { state, toggleTheme } = useAppState();
  const bridge = usePlatform();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // TODO: Drop-to-open workspace is disabled — buggy, not ready.
  // const containerRef = useRef<HTMLDivElement>(null);
  // useEffect(() => {
  //   const el = containerRef.current;
  //   if (!el) return;
  //   const onDragOver = (e: DragEvent) => {
  //     e.preventDefault();
  //     if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  //   };
  //   const onDrop = (e: DragEvent) => {
  //     e.preventDefault();
  //     const files = Array.from(e.dataTransfer?.files ?? []);
  //     if (files.length === 0) return;
  //     const droppedPath = (files[0] as any).path; // Electron exposes .path on File
  //     if (droppedPath) {
  //       bridge.postMessage({ command: 'openPath', path: droppedPath });
  //     }
  //   };
  //   el.addEventListener('dragover', onDragOver);
  //   el.addEventListener('drop', onDrop);
  //   return () => {
  //     el.removeEventListener('dragover', onDragOver);
  //     el.removeEventListener('drop', onDrop);
  //   };
  // }, [bridge]);

  const handleOpenFolder = () => {
    bridge.postMessage({ command: 'openFolder' });
  };

  const handleOpenFile = () => {
    bridge.postMessage({ command: 'openFile' });
  };

  const handleOpenRecent = (path: string) => {
    bridge.postMessage({ command: 'openRecentWorkspace', path });
  };

  const handleDeleteRecent = (path: string) => {
    bridge.postMessage({ command: 'deleteRecentWorkspace', path });
  };

  const recents = state.recentWorkspaces || [];
  const displayRecents = recents.slice(0, 3);

  const filteredRecents = recents.filter(item => {
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q);
  });

  return (
    <div 
      // ref={containerRef} // TODO: Drop-to-open workspace is disabled — buggy, not ready.
      className="workspace-selection" 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        fontFamily: 'var(--font-ui)',
        padding: '40px 20px',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '44px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingRight: '12px',
        zIndex: 200000,
        ...((typeof (window as any).electronAPI !== 'undefined') ? { WebkitAppRegion: 'drag' } : {}) as any
      }}>
        <div className="window-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', ...((typeof (window as any).electronAPI !== 'undefined') ? { WebkitAppRegion: 'no-drag' } : {}) as any }}>
          <TooltipButton
            className="btn btn--icon"
            onClick={toggleTheme}
            tooltip="Toggle Theme"
            icon={
              state.theme === 'dark' || (state.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )
            }
          />
          {typeof (window as any).electronAPI !== 'undefined' && (
            <>
              <div style={{ width: '1px', height: '16px', background: 'var(--bd-s)' }} />
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={() => (window as any).electronAPI.postMessage({ command: 'window-minimize' })}
                tooltip="Minimize"
                icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>}
              />
              <TooltipButton
                className="btn btn--icon window-control-btn"
                onClick={() => (window as any).electronAPI.postMessage({ command: 'window-maximize' })}
                tooltip={state.isMaximized ? "Restore" : "Maximize"}
                icon={state.isMaximized ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M8 3h13v13H8z" />
                    <path d="M16 16v5H3V8h5" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                )}
              />
              <TooltipButton
                className="btn btn--icon window-control-btn window-control-btn--close"
                onClick={() => (window as any).electronAPI.postMessage({ command: 'window-close' })}
                tooltip="Close App"
                icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
              />
            </>
          )}
        </div>
      </div>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '32px'
      }}>
        {/* Title / Hero */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <img src={logoUrl} width="64" height="64" alt="Markdown Explorer" style={{
            opacity: 0.95,
            filter: 'drop-shadow(0 4px 12px rgba(139, 124, 248, 0.2))',
            marginBottom: '8px'
          }} />
          <h1 style={{
            fontSize: '28px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: 0,
            color: 'var(--tx)'
          }}>Markdown Explorer</h1>
          <p style={{
            fontSize: '14px',
            color: 'var(--tx2)',
            margin: 0,
            lineHeight: 1.5
          }}>Documentation viewer & navigator</p>
        </div>

        {/* Core Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleOpenFolder}
            className="btn btn--accent"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '16px 20px',
              fontSize: '14px',
              fontWeight: 600,
              width: '100%',
              height: 'auto',
              borderRadius: 'var(--r-lg)',
              cursor: 'pointer',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(139, 124, 248, 0.25)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 124, 248, 0.35)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 124, 248, 0.25)';
            }}
          >
            <FolderIcon size={16} />
            Open Folder
          </button>

          <button
            onClick={handleOpenFile}
            className="btn btn--outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              fontSize: '12.5px',
              fontWeight: 500,
              width: '100%',
              height: 'auto',
              borderRadius: 'var(--r-lg)',
              cursor: 'pointer',
              border: '1.5px solid var(--bd-s)',
              background: 'transparent',
              color: 'var(--tx2)',
              transition: 'all 0.15s ease',
              marginTop: '4px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--tx)';
              e.currentTarget.style.background = 'rgba(139, 124, 248, 0.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--bd-s)';
              e.currentTarget.style.color = 'var(--tx2)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Open File
          </button>
        </div>

        {/* Recent Workspaces list */}
        {recents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <h3 style={{
              fontSize: '13px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: 0,
              color: 'var(--tx2)'
            }}>Workspaces</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayRecents.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleOpenRecent(item.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    background: 'var(--bg-s)',
                    border: '1px solid var(--bd-s)',
                    borderRadius: 'var(--r-lg)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                  className="recent-workspace-item"
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--bg-h)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--bg-s)';
                    e.currentTarget.style.borderColor = 'var(--bd-s)';
                  }}
                >
                  <FolderIcon size={16} style={{ color: 'var(--accent)', opacity: 0.8, marginTop: '2px', alignSelf: 'flex-start' }} />
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '24px' }}>
                    <div style={{
                      fontSize: '13.5px',
                      fontWeight: 600,
                      color: 'var(--tx)',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{item.name}</div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginTop: '4px'
                    }}>
                      <span style={{
                        fontSize: '11px',
                        color: 'var(--tx2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        direction: 'rtl',
                        textAlign: 'left',
                        flex: 1
                      }}>{item.path}</span>
                      {item.lastOpened && (
                        <span style={{
                          fontSize: '10px',
                          color: 'var(--txm)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap'
                        }}>
                          Last opened: {formatLastOpened(item.lastOpened)}
                        </span>
                      )}
                    </div>
                  </div>

                  <TooltipButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRecent(item.path);
                    }}
                    className="recent-workspace-delete-btn"
                    tooltip="Remove from recents"
                    tooltipPos="above"
                    tooltipAlign="right"
                  >
                    &times;
                  </TooltipButton>
                </div>
              ))}
            </div>

            {recents.length > 3 && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setModalOpen(true);
                }}
                style={{
                  alignSelf: 'center',
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  transition: 'opacity 0.1s'
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              >
                Show More…
              </button>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="mdn-modal"
          style={{ display: 'flex' }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="settings-card" style={{ width: '480px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh' }}>
            <TooltipButton
              className="settings-card__close"
              onClick={() => setModalOpen(false)}
              tooltip="Close"
              tooltipPos="below"
            >
              &times;
            </TooltipButton>
            <div className="settings-card__header" style={{ margin: 0, paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--tx)', margin: 0 }}>Recent Workspaces</h2>
              <p style={{ fontSize: '11.5px', color: 'var(--tx2)', margin: '4px 0 0' }}>Search and manage your recently opened workspaces</p>
            </div>

            {/* Search Input */}
            <div className="search-bar" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-e)',
              border: '1px solid var(--bd-s)',
              borderRadius: 'var(--r-md)',
              height: '36px',
              padding: '0 12px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--txm)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                placeholder="Search workspaces by name or path…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--tx)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-ui)',
                  width: '100%',
                  height: '100%'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--tx2)',
                    fontSize: '16px',
                    cursor: 'pointer',
                    padding: '0 4px'
                  }}
                >
                  &times;
                </button>
              )}
            </div>

            {/* Workspaces Scrollable List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingRight: '4px',
              maxHeight: '352px'
            }}>
              {filteredRecents.length > 0 ? (
                filteredRecents.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      handleOpenRecent(item.path);
                      setModalOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      background: 'var(--bg-s)',
                      border: '1px solid var(--bd-s)',
                      borderRadius: 'var(--r-lg)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                    className="recent-workspace-item"
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--bg-h)';
                      e.currentTarget.style.borderColor = 'var(--accent)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'var(--bg-s)';
                      e.currentTarget.style.borderColor = 'var(--bd-s)';
                    }}
                  >
                    <FolderIcon size={14} style={{ color: 'var(--accent)', opacity: 0.8, marginTop: '2px', alignSelf: 'flex-start' }} />
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '24px' }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--tx)',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>{item.name}</div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginTop: '2px'
                      }}>
                        <span style={{
                          fontSize: '11px',
                          color: 'var(--tx2)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          direction: 'rtl',
                          textAlign: 'left',
                          flex: 1
                        }}>{item.path}</span>
                        {item.lastOpened && (
                          <span style={{
                            fontSize: '9.5px',
                            color: 'var(--txm)',
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                          }}>
                            Last opened: {formatLastOpened(item.lastOpened)}
                          </span>
                        )}
                      </div>
                    </div>

                    <TooltipButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRecent(item.path);
                      }}
                      className="recent-workspace-delete-btn recent-workspace-delete-btn--modal"
                      tooltip="Remove from recents"
                      tooltipPos="above"
                      tooltipAlign="right"
                    >
                      &times;
                    </TooltipButton>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--tx2)',
                  fontSize: '12.5px'
                }}>
                  No matching workspaces found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
