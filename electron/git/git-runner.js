const { execFile } = require('node:child_process');
const { stat } = require('node:fs/promises');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;

class GitHistoryError extends Error {
  constructor(message, reason = 'git-error', cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'GitHistoryError';
    this.reason = reason;
  }
}

const GIT_TIMEOUT_MS = 20000;
const GIT_ENV = { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
// Keep non-ASCII paths verbatim instead of quoted octal escapes.
const GIT_GLOBAL_ARGS = ['-c', 'core.quotePath=false'];

function toGitHistoryError(error) {
  if (error?.code === 'ENOENT') {
    return new GitHistoryError('Git executable is unavailable', 'git-unavailable', error);
  }
  if (error?.killed) {
    return new GitHistoryError('Git command timed out', 'git-timeout', error);
  }
  if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || /maxBuffer/i.test(String(error?.message || ''))) {
    return new GitHistoryError('Git output exceeded the allowed size', 'output-too-large', error);
  }
  return new GitHistoryError(String(error?.stderr || error?.message || 'Git command failed').trim(), 'git-command-failed', error);
}

async function isDirectory(value) {
  try {
    return (await stat(value)).isDirectory();
  } catch {
    return false;
  }
}

async function runGit(cwd, args) {
  try {
    const { stdout } = await execFileAsync('git', [...GIT_GLOBAL_ARGS, ...args], {
      cwd,
      windowsHide: true,
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      env: { ...process.env, ...GIT_ENV },
    });
    return stdout;
  } catch (error) {
    // spawn reports ENOENT for a missing cwd too; do not blame Git for a deleted folder.
    if (error?.code === 'ENOENT' && !(await isDirectory(cwd))) {
      throw new GitHistoryError('The workspace folder does not exist', 'not-repository', error);
    }
    throw toGitHistoryError(error);
  }
}

module.exports = {
  GIT_TIMEOUT_MS,
  GitHistoryError,
  MAX_GIT_OUTPUT_BYTES,
  runGit,
  toGitHistoryError,
};
