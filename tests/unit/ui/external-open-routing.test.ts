import { describe, expect, test } from 'vitest';
import { createExternalOpenCommand } from '../../../ui/src/hooks/useDesktopTabSearchSync';

describe('structured external-open routing', () => {
  const operation = { workspaceOperationId: 'op-1', workspaceTabId: 'tab-1' };

  test('routes parent-workspace file requests through activateWorkspace', () => {
    expect(createExternalOpenCommand({
      mode: 'file-with-parent-workspace',
      filePath: 'C:/Repo/docs/guide.md',
      folderPath: 'C:/Repo/docs',
    }, operation)).toEqual({
      command: 'activateWorkspace',
      workspacePath: 'C:/Repo/docs',
      filePath: 'C:/Repo/docs/guide.md',
      openFirstFile: false,
      ...operation,
    });
  });

  test('keeps plain file and folder requests on openPath', () => {
    expect(createExternalOpenCommand({ mode: 'file', filePath: 'C:/Docs/readme.md' })).toEqual({
      command: 'openPath', path: 'C:/Docs/readme.md', openFirstFile: false,
    });
    expect(createExternalOpenCommand({ mode: 'folder', folderPath: 'C:/Docs' }, operation)).toEqual({
      command: 'openPath', path: 'C:/Docs', openFirstFile: false, ...operation,
    });
  });
});
