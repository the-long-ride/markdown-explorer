import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPanelFontBridge,
  getGlobalStorageUri,
} from '../../../vscode/src/fonts/panelFontBridge.ts';

const sourceFont = path.resolve('ui/assets/fonts/JetBrainsMono/JetBrainsMono-VariableFont_wght.ttf');

describe('panelFontBridge', () => {
  let tempRoot: string;
  let globalStorageDir: string;
  let workspaceDir: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'panel-font-bridge-'));
    globalStorageDir = path.join(tempRoot, 'storage');
    workspaceDir = path.join(tempRoot, 'workspace');
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  describe('getGlobalStorageUri', () => {
    it('returns context.globalStorageUri when present', () => {
      const mockUri = { fsPath: '/custom/storage' } as any;
      const context = { globalStorageUri: mockUri } as any;
      const vscodeApi = { Uri: { file: (p: string) => ({ fsPath: p }) } } as any;

      expect(getGlobalStorageUri(context, vscodeApi)).toBe(mockUri);
    });

    it('falls back to extensionPath storage folder when globalStorageUri is undefined', () => {
      const context = { extensionPath: '/ext/root' } as any;
      const vscodeApi = {
        Uri: { file: (p: string) => ({ fsPath: p }) },
      } as any;

      const uri = getGlobalStorageUri(context, vscodeApi);
      expect(uri.fsPath).toContain('.markdown-explorer-global-storage');
    });
  });

  describe('createPanelFontBridge handling', () => {
    function createMockEnvironment() {
      const posted: any[] = [];
      const webview = {
        postMessage: vi.fn(async (msg) => { posted.push(msg); }),
        asWebviewUri: vi.fn((uri) => ({ toString: () => `vscode-cdn://${uri.fsPath}` })),
      };

      const context = {
        globalStorageUri: { fsPath: globalStorageDir },
        subscriptions: [] as any[],
      };

      const vscodeApi = {
        Uri: {
          file: (p: string) => ({ fsPath: p }),
          parse: (p: string) => ({ fsPath: p }),
        },
        workspace: {
          workspaceFolders: [{ uri: { fsPath: workspaceDir } }],
        },
        window: {
          showOpenDialog: vi.fn(),
        },
      };

      const bridge = createPanelFontBridge(webview as any, context as any, vscodeApi as any);
      return { bridge, posted, vscodeApi };
    }

    it('handles listDesktopFonts request', async () => {
      const { bridge, posted } = createMockEnvironment();

      const handled = await bridge.handle({
        command: 'listDesktopFonts',
        requestId: 'req-1',
      });

      expect(handled).toBe(true);
      expect(posted).toHaveLength(1);
      expect(posted[0].command).toBe('desktopFontsResult');
      expect(posted[0].requestId).toBe('req-1');
      expect(Array.isArray(posted[0].fonts)).toBe(true);
    });

    it('handles importDesktopFonts dialog cancellation', async () => {
      const { bridge, posted, vscodeApi } = createMockEnvironment();
      vscodeApi.window.showOpenDialog.mockResolvedValue(undefined);

      const handled = await bridge.handle({
        command: 'importDesktopFonts',
        requestId: 'req-2',
      });

      expect(handled).toBe(true);
      expect(posted).toHaveLength(1);
      expect(posted[0].command).toBe('desktopFontsResult');
      expect(posted[0].requestId).toBe('req-2');
    });

    it('handles importDesktopFonts successful font import', async () => {
      const { bridge, posted, vscodeApi } = createMockEnvironment();
      vscodeApi.window.showOpenDialog.mockResolvedValue([{ fsPath: sourceFont }]);

      const handled = await bridge.handle({
        command: 'importDesktopFonts',
        requestId: 'req-3',
      });

      expect(handled).toBe(true);
      expect(posted).toHaveLength(1);
      const res = posted[0];
      expect(res.command).toBe('desktopFontsResult');
      expect(res.requestId).toBe('req-3');
      expect(res.importedId).toMatch(/^font_/);
      expect(res.fonts.some((f: any) => f.id === res.importedId)).toBe(true);
    });

    it('handles importDesktopFonts and removeImportedDesktopFont errors gracefully', async () => {
      const { bridge, posted, vscodeApi } = createMockEnvironment();
      const badPath = path.join(tempRoot, 'not-a-font.txt');
      await writeFile(badPath, 'bad');

      vscodeApi.window.showOpenDialog.mockResolvedValue([{ fsPath: badPath }]);

      await bridge.handle({
        command: 'importDesktopFonts',
        requestId: 'req-err',
      });

      expect(posted).toHaveLength(1);
      expect(posted[0].error).toContain('Only .ttf and .otf font files can be imported.');

      // Remove with invalid ID
      await bridge.handle({
        command: 'removeImportedDesktopFont',
        requestId: 'req-rem-err',
        id: 'invalid-id!!!',
      });

      expect(posted).toHaveLength(2);
      expect(posted[1].error).toContain('Invalid imported font id.');
    });

    it('disposes resources cleanly', () => {
      const { bridge } = createMockEnvironment();
      expect(() => bridge.dispose()).not.toThrow();
    });
  });
});
