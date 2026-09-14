function requestIdOf(message) {
  return typeof message?.requestId === 'string' ? message.requestId : '';
}

function failureReason(error, GitHistoryError) {
  return error instanceof GitHistoryError
    ? error.reason
    : String(error?.message || error || 'git-error');
}

function createGitHistoryMessageHandlers({ getWorkspacePath, sendHostMessage }) {
  const history = require('./document-history');
  const workspacePath = () => getWorkspacePath?.() || null;
  const reasonOf = (error) => failureReason(error, history.GitHistoryError);

  async function handleGetGitCapability(message = {}) {
    const capability = await history.detectGitCapability(workspacePath());
    sendHostMessage({ command: 'gitCapabilityResult', requestId: requestIdOf(message), capability });
  }

  async function handleListDocumentHistory(message = {}) {
    try {
      const revisions = await history.listDocumentHistory({
        workspacePath: workspacePath(),
        filePath: message.filePath,
        limit: message.limit,
      });
      sendHostMessage({ command: 'documentHistoryResult', requestId: requestIdOf(message), ok: true, revisions });
    } catch (error) {
      sendHostMessage({ command: 'documentHistoryResult', requestId: requestIdOf(message), ok: false, revisions: [], reason: reasonOf(error) });
    }
  }

  async function handleListRepositoryHistory(message = {}) {
    try {
      const commits = await history.listRepositoryHistory({ workspacePath: workspacePath(), limit: message.limit });
      sendHostMessage({ command: 'repositoryHistoryResult', requestId: requestIdOf(message), ok: true, commits });
    } catch (error) {
      sendHostMessage({ command: 'repositoryHistoryResult', requestId: requestIdOf(message), ok: false, commits: [], reason: reasonOf(error) });
    }
  }

  async function handleListRevisionFiles(message = {}) {
    try {
      const files = await history.listRevisionFiles({ workspacePath: workspacePath(), oid: message.oid });
      sendHostMessage({ command: 'revisionFilesResult', requestId: requestIdOf(message), ok: true, files });
    } catch (error) {
      sendHostMessage({ command: 'revisionFilesResult', requestId: requestIdOf(message), ok: false, files: [], reason: reasonOf(error) });
    }
  }

  async function handleReadRevisionFile(message = {}) {
    try {
      const snapshot = await history.readRevisionFile({ workspacePath: workspacePath(), oid: message.oid, path: message.path });
      sendHostMessage({ command: 'revisionFileResult', requestId: requestIdOf(message), ok: true, snapshot });
    } catch (error) {
      sendHostMessage({ command: 'revisionFileResult', requestId: requestIdOf(message), ok: false, reason: reasonOf(error) });
    }
  }

  async function handleReadGitRevision(message = {}) {
    try {
      const snapshot = await history.readGitRevision({ workspacePath: workspacePath(), oid: message.oid, path: message.path });
      sendHostMessage({ command: 'gitRevisionResult', requestId: requestIdOf(message), ok: true, snapshot });
    } catch (error) {
      sendHostMessage({ command: 'gitRevisionResult', requestId: requestIdOf(message), ok: false, reason: reasonOf(error) });
    }
  }

  async function handleCompareGitRevisions(message = {}) {
    try {
      const result = await history.compareGitSources({ workspacePath: workspacePath(), left: message.left, right: message.right });
      sendHostMessage({ command: 'gitComparisonResult', requestId: requestIdOf(message), ok: true, ...result });
    } catch (error) {
      sendHostMessage({ command: 'gitComparisonResult', requestId: requestIdOf(message), ok: false, reason: reasonOf(error) });
    }
  }

  return {
    handleGetGitCapability,
    handleListDocumentHistory,
    handleListRepositoryHistory,
    handleListRevisionFiles,
    handleReadRevisionFile,
    handleReadGitRevision,
    handleCompareGitRevisions,
  };
}

module.exports = {
  createGitHistoryMessageHandlers,
};
