import { generateMarkdown } from '@the-long-ride/markdown-them';
import { pathToFileURL } from 'node:url';
import { runProtocol } from './protocol.mjs';

export async function main({
  input = process.stdin,
  output = process.stdout,
  errorOutput = process.stderr,
  convert = generateMarkdown,
} = {}) {
  await runProtocol({ input, output, errorOutput, convert });
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryUrl) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`[sidecar] fatal: ${message}\n`);
    process.exitCode = 1;
  });
}
