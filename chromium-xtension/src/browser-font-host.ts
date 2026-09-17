import { importBrowserFont, listBrowserFonts, removeBrowserFont } from './browser-font-service';
import { handleBrowserGitHistoryCommand } from './browser-git-history-host';

type BrowserFontHostSend = (message: Record<string, unknown>) => void;

export async function handleBrowserFontHostCommand(
  msg: any,
  send: BrowserFontHostSend,
): Promise<boolean> {
  if (await handleBrowserGitHistoryCommand(msg, send)) return true;
  if (!['listDesktopFonts', 'importDesktopFonts', 'removeImportedDesktopFont'].includes(msg?.command)) return false;

  try {
    if (msg.command === 'listDesktopFonts') {
      send({ command: 'desktopFontsResult', requestId: msg.requestId, fonts: await listBrowserFonts() });
    } else if (msg.command === 'importDesktopFonts') {
      const result = await importBrowserFont();
      send({ command: 'desktopFontsResult', requestId: msg.requestId, fonts: result.fonts, importedId: result.importedId });
    } else {
      send({ command: 'desktopFontsResult', requestId: msg.requestId, fonts: await removeBrowserFont(msg.id) });
    }
  } catch (error) {
    send({
      command: 'desktopFontsResult',
      requestId: msg.requestId,
      fonts: await listBrowserFonts().catch(() => []),
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return true;
}
