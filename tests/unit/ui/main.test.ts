import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectBridge } from '../../../../ui/src/main';

vi.mock('../../../../ui/src/platform/vscode', () => ({
  createVsCodeBridge: () => ({ type: 'vscode' }),
}));
vi.mock('../../../../ui/src/platform/electron', () => ({
  createElectronBridge: () => ({ type: 'electron' }),
}));
vi.mock('../../../../ui/src/platform/chrome', () => ({
  createChromeBridge: () => ({ type: 'chrome' }),
}));

describe('detectBridge', () => {
  afterEach(() => {
    (globalThis as any).acquireVsCodeApi = undefined;
    (globalThis as any).electronAPI = undefined;
    (globalThis as any).__chromeExtBus = undefined;
  });

  it('detects VS Code platform', () => {
    const bridge = detectBridge({ acquireVsCodeApi: vi.fn() });
    expect(bridge.type).toBe('vscode');
  });

  it('detects Electron platform', () => {
    const bridge = detectBridge({ electronAPI: {} });
    expect(bridge.type).toBe('electron');
  });

  it('detects Chrome extension platform', () => {
    const bridge = detectBridge({ __chromeExtBus: {} });
    expect(bridge.type).toBe('chrome');
  });

  it('prioritizes VS Code over Electron', () => {
    const bridge = detectBridge({ acquireVsCodeApi: vi.fn(), electronAPI: {} });
    expect(bridge.type).toBe('vscode');
  });

  it('prioritizes Electron over Chrome', () => {
    const bridge = detectBridge({ electronAPI: {}, __chromeExtBus: {} });
    expect(bridge.type).toBe('electron');
  });

  it('throws for unknown platform', () => {
    expect(() => detectBridge({})).toThrow('Unknown platform');
  });

  it('throws when no platform globals exist', () => {
    expect(() => detectBridge()).toThrow();
  });
});
