import * as fs from 'fs';
import { isSupportedFilePath } from './documentConversion';
import { normalizePanelPath, resolvePanelNavigationPath } from './panelNavigation';
import type { MdFile } from '../types';

interface PanelNavigationOptions {
  href: string | null;
  currentFile: string | null;
  workspaceRoot: string;
  files: readonly MdFile[];
  documentConversionEnabled: boolean;
  setCurrentFile: (filePath: string | null) => void;
  sendContent: () => Promise<void>;
  sendWelcome: () => Promise<void>;
  sendNotFound: (href: string) => Thenable<boolean>;
}

export async function navigatePanel(options: PanelNavigationOptions): Promise<void> {
  const { href, currentFile, workspaceRoot, files, documentConversionEnabled,
    setCurrentFile, sendContent, sendWelcome, sendNotFound } = options;
  if (!href) {
    setCurrentFile(null);
    await sendWelcome();
    return;
  }
  const resolvedPath = resolvePanelNavigationPath(href, currentFile, workspaceRoot);
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    const folder = normalizePanelPath(resolvedPath);
    const child = files.find((file) => {
      const normalized = normalizePanelPath(file.fsPath);
      return normalized === folder || normalized.startsWith(`${folder}/`);
    });
    setCurrentFile(child?.fsPath ?? null);
    if (child) await sendContent();
    else await sendWelcome();
    return;
  }
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()
    && isSupportedFilePath(resolvedPath, documentConversionEnabled)) {
    setCurrentFile(resolvedPath);
    await sendContent();
    return;
  }
  const normalizedHref = normalizePanelPath(resolvedPath);
  const found = files.find((file) => normalizePanelPath(file.fsPath) === normalizedHref
    || normalizePanelPath(file.relativePath) === normalizedHref);
  if (found) {
    setCurrentFile(found.fsPath);
    await sendContent();
  } else {
    await sendNotFound(resolvedPath);
  }
}
