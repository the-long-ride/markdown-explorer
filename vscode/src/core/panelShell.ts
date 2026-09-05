import * as fs from 'fs';
import * as path from 'path';

export function buildWebviewShell(
  extensionPath: string,
  panel: import('vscode').WebviewPanel,
  vscode: typeof import('vscode'),
  isDebug?: boolean,
) {
  const distPath = path.join(extensionPath, 'ui', 'dist');
  const indexPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) return '<!DOCTYPE html><html><body><h2>Markdown Explorer UI has not been built.</h2><p>Please run pnpm run build before opening the extension.</p></body></html>';
  let html = fs.readFileSync(indexPath, 'utf8');
  const cspSource = panel.webview.cspSource;
  const csp = `default-src 'none'; style-src 'unsafe-inline' ${cspSource}; font-src ${cspSource} data:; script-src 'unsafe-inline' blob: ${cspSource}; worker-src blob:; img-src * data: blob: ${cspSource}; media-src * data: blob: ${cspSource}; frame-src 'self' data: ${cspSource} https://www.youtube.com https://www.youtube-nocookie.com; connect-src *;`;
  const baseUri = panel.webview.asWebviewUri(vscode.Uri.file(distPath));
  const debugTag = isDebug ? '<script>window.__DEBUG__ = true;</script>' : '';
  html = html.replace('<head>', `<head>${debugTag}<meta http-equiv="Content-Security-Policy" content="${csp}" /><base href="${baseUri.toString()}/" />`);
  return html;
}
