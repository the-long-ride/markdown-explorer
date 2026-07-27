import { createInterface } from 'node:readline';

function requestId(request) {
  return typeof request?.id === 'string' && request.id ? request.id : null;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function handleRequest(request, convert) {
  const id = requestId(request);

  if (request?.command !== 'convert') {
    return { id, ok: false, error: `Unknown command: ${String(request?.command ?? '')}` };
  }
  if (typeof request?.path !== 'string' || !request.path.trim()) {
    return { id, ok: false, error: 'A non-empty document path is required.' };
  }

  try {
    const markdown = await convert(request.path);
    return { id, ok: true, markdown };
  } catch (error) {
    return { id, ok: false, error: errorMessage(error) };
  }
}

export async function runProtocol({
  input,
  output,
  errorOutput = process.stderr,
  convert,
}) {
  const lines = createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line.trim()) continue;

    let request;
    try {
      request = JSON.parse(line);
    } catch (error) {
      errorOutput.write(`[sidecar] invalid JSON: ${errorMessage(error)}\n`);
      output.write(`${JSON.stringify({ id: null, ok: false, error: 'Invalid JSON request.' })}\n`);
      continue;
    }

    const response = await handleRequest(request, convert);
    output.write(`${JSON.stringify(response)}\n`);
  }
}
