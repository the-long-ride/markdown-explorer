const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..');
const requiredRuntimeFiles = [
  path.join('out', 'vscode', 'src', 'extension.js'),
  path.join('out', 'vscode', 'src', 'vendor', 'markdown-them.cjs'),
  path.join('out', 'node_modules', 'yaml', 'index.js'),
  path.join('ui', 'dist', 'index.html'),
];

function findMissingRuntimeFiles({ fsImpl = fs, root = extensionRoot, requiredFiles = requiredRuntimeFiles } = {}) {
  return requiredFiles.filter((relativePath) => !fsImpl.existsSync(path.join(root, relativePath)));
}

function verifyPackageRuntime({ fsImpl = fs, root = extensionRoot, requiredFiles = requiredRuntimeFiles, logger = console } = {}) {
  const missingFiles = findMissingRuntimeFiles({ fsImpl, root, requiredFiles });
  if (missingFiles.length > 0) {
    logger.error('VSIX runtime verification failed. Missing packaged runtime files:');
    for (const relativePath of missingFiles) logger.error(`- ${relativePath}`);
    return { ok: false, missingFiles };
  }
  logger.log(`Verified ${requiredFiles.length} VSIX runtime files.`);
  return { ok: true, missingFiles: [] };
}

function verifyCompiledActivation({
  root = extensionRoot,
  manifest,
  requireImpl = require,
  registerCommand,
  logger = console,
} = {}) {
  const packageJson = manifest ?? JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const mainPath = path.resolve(root, packageJson.main);
  const commands = packageJson.contributes?.commands?.map(({ command }) => command) ?? [];
  const registeredCommands = new Set();
  const register = (command) => {
    registeredCommands.add(command);
    return registerCommand?.(command) ?? { dispose() {} };
  };

  try {
    const extension = requireImpl(mainPath);
    if (typeof extension._doActivate !== 'function') {
      throw new Error(`Compiled extension does not export _doActivate: ${mainPath}`);
    }
    extension._doActivate(
      { subscriptions: { push() {} } },
      {
        commands: { registerCommand: register },
        window: { activeTextEditor: undefined },
        workspace: {
          onDidSaveTextDocument: () => ({ dispose() {} }),
          getConfiguration: () => ({ get: () => false }),
          createFileSystemWatcher: () => ({
            onDidCreate() {},
            onDidChange() {},
            onDidDelete() {},
            dispose() {},
          }),
        },
      },
    );
    requireImpl(path.resolve(root, 'out', 'vscode', 'src', 'core', 'panel.js'));
  } catch (error) {
    logger.error(`Compiled extension activation failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    return { ok: false, missingCommands: commands, error };
  }

  const missingCommands = commands.filter((command) => !registeredCommands.has(command));
  if (missingCommands.length > 0) {
    logger.error('Compiled extension activation did not register contributed commands:');
    for (const command of missingCommands) logger.error(`- ${command}`);
    return { ok: false, missingCommands };
  }

  logger.log(`Verified compiled extension activation for ${commands.length} commands.`);
  return { ok: true, missingCommands: [] };
}

if (require.main === module) {
  const result = verifyPackageRuntime();
  if (!result.ok) {
    process.exitCode = 1;
  } else if (!verifyCompiledActivation().ok) {
    process.exitCode = 1;
  }
}

module.exports = {
  extensionRoot,
  requiredRuntimeFiles,
  findMissingRuntimeFiles,
  verifyPackageRuntime,
  verifyCompiledActivation,
};
