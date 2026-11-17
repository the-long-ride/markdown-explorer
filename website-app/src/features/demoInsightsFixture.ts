// =============================================================================
// website-app/src/features/demoInsightsFixture.ts
// Real analyzer-backed WorkspaceInsightsSessionViewModel for the Insights demo.
// =============================================================================

import type { InsightsViewKey } from '../../../ui/src/components/Insights/WorkspaceInsightsPanel';
import { analyzeDocument } from '../../../ui/src/insights/analyzeDocument';
import type { ExternalLinkCheckResult } from '../../../ui/src/insights/contracts';
import { WorkspaceInsightsIndex, type WorkspaceInsightsSnapshot } from '../../../ui/src/insights/index';
import {
  workspaceWikiDescriptors,
  type WorkspaceInsightsSessionViewModel,
} from '../../../ui/src/insights/workspaceInsightsSession';
import type { InsightsSourceInput } from '../../../ui/src/insights/workerProtocol';
import type { WikiResolverContext } from '../../../ui/src/markdown/wikiLinks';
import { DEMO_DOCS } from './demoMarkdownFixtures';

export type WorkspaceInsightsTabKey = InsightsViewKey | 'library';

function buildDemoInsightsSnapshot(): WorkspaceInsightsSnapshot {
  const index = new WorkspaceInsightsIndex();
  for (const doc of Object.values(DEMO_DOCS)) {
    const analyzed = analyzeDocument({
      path: doc.path,
      source: doc.markdown,
      revision: String(doc.markdown.length),
    });
    index.applyDocument(analyzed);
  }
  return index.snapshot();
}

const BASE_SNAPSHOT = buildDemoInsightsSnapshot();

export function createDemoInsightsSession(
  _activeTab?: WorkspaceInsightsTabKey,
  _setActiveTab?: (tab: WorkspaceInsightsTabKey) => void,
  onOpenDoc?: (path: string) => void,
): WorkspaceInsightsSessionViewModel {
  const index = new WorkspaceInsightsIndex();
  for (const doc of BASE_SNAPSHOT.documents.values()) {
    index.applyDocument(doc);
  }
  let snapshot = index.snapshot();
  const externalResults = new Map<string, ExternalLinkCheckResult>();
  const approvedPrivateOrigins = new Set<string>();

  return {
    panelOpen: true,
    status: 'ready',
    snapshot,
    progress: {
      completed: snapshot.documents.size,
      total: snapshot.documents.size,
      provisional: false,
    },
    warnings: [],
    workerMode: 'worker',
    externalResults,
    approvedPrivateOrigins,
    async open() {
      // Demo panel is mounted permanently open inside the Insights showcase stage.
    },
    closePanel() {
      // Keep panel visible in demo mode; callers can switch feature tabs instead.
    },
    async refreshLocal() {
      snapshot = buildDemoInsightsSnapshot();
    },
    pause() {},
    dispose() {},
    async applyActiveOverlay(document: InsightsSourceInput) {
      const analyzed = analyzeDocument({
        path: document.path,
        source: document.source,
        revision: document.revision,
      });
      index.applyActiveOverlay(analyzed);
      snapshot = index.snapshot();
    },
    async clearActiveOverlay(path: string) {
      index.clearActiveOverlay(path);
      snapshot = index.snapshot();
    },
    async checkExternalLinks(urls: readonly string[]) {
      return urls.map((url) => ({
        requestId: 'demo-external-check',
        url,
        status: 'reachable' as const,
        httpStatus: 200,
        checkedAt: new Date().toISOString(),
      }));
    },
    cancelExternalChecks() {},
    approvePrivateOrigin(origin: string) {
      approvedPrivateOrigins.add(origin);
    },
    async getWikiResolverContext(sourceDocumentPath: string): Promise<WikiResolverContext> {
      if (onOpenDoc && sourceDocumentPath) {
        // Expose document catalog for wiki link previews without mutating active doc.
      }
      return {
        sourceDocumentPath,
        documents: workspaceWikiDescriptors(snapshot),
      };
    },
  };
}
