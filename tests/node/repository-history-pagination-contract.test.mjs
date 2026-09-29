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

assert.match(messages, /ListRepositoryHistoryMessage[^\n]*offset\?: number[^\n]*before\?: string[^\n]*allRefs\?: boolean/);
assert.match(client, /listRepositoryHistory\(query\?: RepositoryHistoryQuery\)/);
assert.match(client, /before === undefined[\s\S]*allRefs === undefined/);
assert.match(electron, /--until=/);
assert.match(electronHandlers, /before:\s*message\.before/);
assert.match(electronHandlers, /allRefs:\s*message\.allRefs === true/);
assert.match(vscode, /--until=/);
assert.match(vscode, /allRefs: msg\.allRefs === true/);
assert.match(tauriRepository, /--until=/);
assert.match(tauriHistory, /get\("offset"\)/);
assert.match(tauriHistory, /get\("before"\)/);
assert.match(tauriHistory, /get\("allRefs"\)/);
assert.match(context, /before: commits\[commits\.length - 1\]|const before = commits\[commits\.length - 1\]/);
assert.match(context, /loadMoreHistory/);
assert.match(context, /hasMoreHistory/);
assert.match(panel, /filterRepositoryCommits/);
assert.match(panel, /repository-history__search/);
assert.match(panel, /onScroll/);
assert.match(appState, /openRepositoryHistorySidebar/);
assert.match(appState, /SET_SIDEBAR_ACTIVE_TAB[^\n]*history/);
assert.match(historyContext, /DOCUMENT_HISTORY_OPEN_EVENT/);
assert.match(historyContext, /openRepositoryHistorySidebar/);
