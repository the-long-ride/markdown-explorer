import { createChromeInsightsHost } from './chrome-host-insights';

interface InsightsHostRouterContext {
  activeHandle: FileSystemDirectoryHandle | null;
  send: (message: any) => void;
}

let currentHandle: FileSystemDirectoryHandle | null = null;
let currentSend: (message: any) => void = () => {};

const host = createChromeInsightsHost({
  getActiveHandle: () => currentHandle,
  send: (message) => currentSend(message),
});

export async function handleBrowserInsightsHostCommand(
  message: any,
  context: InsightsHostRouterContext,
): Promise<boolean> {
  currentHandle = context.activeHandle;
  currentSend = context.send;

  switch (message.command) {
    case 'scanInsightsWorkspace':
      await host.scanInsightsWorkspace(message);
      return true;
    case 'cancelInsightsScan':
      host.cancelInsightsScan(message);
      return true;
    case 'readInsightsDocumentSource':
      await host.readInsightsDocumentSource(message);
      return true;
    case 'probeWorkspaceResource':
      await host.probeWorkspaceResource(message);
      return true;
    case 'setInsightsWatchState':
      host.setInsightsWatchState(message);
      return true;
    case 'checkExternalLinks':
      for (const url of Array.isArray(message.urls) ? message.urls : []) {
        context.send({
          command: 'externalLinkCheckResult',
          requestId: message.requestId,
          url,
          status: 'unsupported',
          reason: 'Browser runtime cannot provide DNS/IP-pinned HTTP status checks.',
        });
      }
      context.send({ command: 'externalLinkCheckComplete', requestId: message.requestId, cancelled: false });
      return true;
    case 'cancelExternalLinkChecks':
      context.send({ command: 'externalLinkCheckComplete', requestId: message.requestId, cancelled: true });
      return true;
    default:
      return false;
  }
}

export function disposeBrowserInsightsHost(): void {
  host.dispose();
  currentHandle = null;
}
