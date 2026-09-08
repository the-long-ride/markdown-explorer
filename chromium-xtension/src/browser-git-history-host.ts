type BrowserGitHostSend = (message: Record<string, unknown>) => void;

const GIT_HISTORY_COMMANDS = new Set([
  'getGitCapability',
  'listDocumentHistory',
  'readGitRevision',
  'compareGitRevisions',
]);

export async function handleBrowserGitHistoryCommand(
  msg: any,
  send: BrowserGitHostSend,
): Promise<boolean> {
  if (!GIT_HISTORY_COMMANDS.has(msg?.command)) return false;
  const requestId = typeof msg.requestId === 'string' ? msg.requestId : '';

  switch (msg.command) {
    case 'getGitCapability':
      send({
        command: 'gitCapabilityResult',
        requestId,
        capability: { supported: false, reason: 'unsupported-runtime' },
      });
      break;
    case 'listDocumentHistory':
      send({ command: 'documentHistoryResult', requestId, ok: false, revisions: [], reason: 'unsupported-runtime' });
      break;
    case 'readGitRevision':
      send({ command: 'gitRevisionResult', requestId, ok: false, reason: 'unsupported-runtime' });
      break;
    case 'compareGitRevisions':
      send({ command: 'gitComparisonResult', requestId, ok: false, reason: 'unsupported-runtime' });
      break;
  }
  return true;
}
