import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export interface WorkspaceFixture {
  rootDir: string;
  filePaths: string[];
  cleanup: () => void;
}

export function createWorkspaceFixture(files: Record<string, string> = {}): WorkspaceFixture {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-fixture-'));
  const filePaths: string[] = [];

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    filePaths.push(filePath);
  }

  return {
    rootDir,
    filePaths,
    cleanup() {
      fs.rmSync(rootDir, { recursive: true, force: true });
    },
  };
}

export function createScannerItems(rootDir: string, relativePaths: string[]) {
  return relativePaths.map((relativePath) => ({
    fsPath: path.join(rootDir, relativePath),
    fileName: path.basename(relativePath),
    relativePath,
    title: path.basename(relativePath, path.extname(relativePath)),
  }));
}
