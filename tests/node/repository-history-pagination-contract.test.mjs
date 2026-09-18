import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function read(path) {
  return readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');
}

const client = read('ui/src/history/historyClient.ts');
const messages = read('ui/src/types/webviewMessages.ts');
const context = read('ui/src/contexts/RepositorySnapshotContext.tsx');
const appState = read('ui/src/contexts/AppStateContext.tsx');
const historyContext = read('ui/src/contexts/HistoryContext.tsx');
const panel = read('ui/src/components/History/RepositoryHistoryPanel.tsx');
const electron = read('electron/git/document-history.js');
const electronHandlers = read('electron/git/git-history-handlers.js');
const vscode = read('vscode/src/core/panelGitHistory.ts');
const tauriRepository = read('tauri/src/dispatcher/git_repository.rs');
const tauriHistory = read('tauri/src/dispatcher/git_history.rs');

assert.match(messages, /ListRepositoryHistoryMessage[^\n]*offset\?: number/);
assert.match(client, /listRepositoryHistory\(limit\?: number, offset\?: number\)/);
assert.match(client, /offset === undefined[\s\S]*offset/);
assert.match(electron, /--skip=/);
assert.match(electronHandlers, /offset:\s*message\.offset/);
assert.match(vscode, /--skip=/);
assert.match(tauriRepository, /--skip=/);
assert.match(tauriHistory, /get\("offset"\)/);
assert.match(context, /loadMoreHistory/);
assert.match(context, /hasMoreHistory/);
assert.match(panel, /filterRepositoryCommits/);
assert.match(panel, /repository-history__search/);
assert.match(panel, /onScroll/);
assert.match(appState, /openRepositoryHistorySidebar/);
assert.match(appState, /SET_SIDEBAR_ACTIVE_TAB[^\n]*history/);
assert.match(historyContext, /DOCUMENT_HISTORY_OPEN_EVENT/);
assert.match(historyContext, /openRepositoryHistorySidebar/);
