import * as fs from 'fs';
import * as path from 'path';
import { isSameOrInsidePath } from './panelNavigation';

interface WorkspaceTextResourceMessage {
  requestId: string;
  documentPath: string;
  resourcePath: string;
}

export async function readPanelWorkspaceTextResource(
  message: WorkspaceTextResourceMessage,
  workspaceRoot: string | undefined,
  parseFileUri: (uri: string) => string,
  respond: (payload: Record<string, unknown>) => Thenable<boolean>,
): Promise<void> {
  if (!workspaceRoot || !message.documentPath || !message.resourcePath) {
    await respond({ ok: false, reason: 'unsupported' });
    return;
  }
  const reference = String(message.resourcePath).split(/[?#]/, 1)[0];
  if (!reference || /^(?:https?:|data:|blob:|javascript:)/i.test(reference)) {
    await respond({ ok: false, reason: 'unsupported' });
    return;
  }
  try {
    const resolvedPath = /^file:\/\//i.test(reference)
      ? parseFileUri(reference)
      : reference.startsWith('/')
        ? path.resolve(workspaceRoot, `.${reference}`)
        : path.isAbsolute(reference)
          ? path.normalize(reference)
          : path.resolve(path.dirname(message.documentPath), reference);
    if (!/\.(?:css|js|mjs|cjs)$/i.test(resolvedPath) || !isSameOrInsidePath(workspaceRoot, resolvedPath)) {
      await respond({ ok: false, reason: 'outside-workspace' });
      return;
    }
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      await respond({ ok: false, reason: 'missing' });
      return;
    }
    const workspaceReal = fs.realpathSync(workspaceRoot);
    const targetReal = fs.realpathSync(resolvedPath);
    if (!isSameOrInsidePath(workspaceReal, targetReal)) {
      await respond({ ok: false, reason: 'outside-workspace' });
      return;
    }
    await respond({ ok: true, content: fs.readFileSync(targetReal, 'utf8'), resolvedPath: targetReal });
  } catch {
    await respond({ ok: false, reason: 'unreadable' });
  }
}
