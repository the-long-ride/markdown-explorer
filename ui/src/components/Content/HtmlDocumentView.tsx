import { memo, useEffect, useState } from 'react';
import { usePlatform } from '../../contexts/PlatformContext';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';
import { readWorkspaceTextResource } from '../../platform/bridge';
import {
  prepareLocalFirstHtmlPreview,
  type HtmlLocalFirstPolicyReport,
} from '../../markdown/htmlLocalFirstPreview';

export interface HtmlDocumentViewProps {
  filePath: string;
  htmlSource: string;
  markdownHtml: string;
  previewEnabled: boolean;
  title: string;
  conversionError?: string | null;
  allowUpstreamResources?: boolean;
  onPolicyReport?: (report: HtmlLocalFirstPolicyReport) => void;
}

/**
 * Renders a local HTML document inside an opaque-origin iframe. Workspace-local
 * CSS and JavaScript are embedded by the host-backed local-first preparation
 * pipeline, while the sandbox prevents access to the Markdown Explorer shell.
 */
export const HtmlDocumentView = memo(function HtmlDocumentView({
  filePath,
  htmlSource,
  markdownHtml,
  previewEnabled,
  title,
  conversionError,
  allowUpstreamResources = false,
  onPolicyReport,
}: HtmlDocumentViewProps) {
  const bridge = usePlatform();
  const { state } = useAppState();
  const t = getTranslations(state.settings.language || 'en');
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!previewEnabled) {
      setSrcDoc(null);
      setPreviewError(null);
      return () => { cancelled = true; };
    }

    setSrcDoc(null);
    setPreviewError(null);
    void prepareLocalFirstHtmlPreview({
      htmlSource,
      documentPath: filePath,
      readLocalText: (resourcePath, baseDocumentPath) =>
        readWorkspaceTextResource(bridge, baseDocumentPath, resourcePath),
      allowUpstreamResources,
    }).then((prepared) => {
      if (cancelled) return;
      setSrcDoc(prepared.documentHtml);
      if (!allowUpstreamResources) onPolicyReport?.(prepared.policyReport);
    }).catch((error) => {
      if (cancelled) return;
      setPreviewError(error instanceof Error ? error.message : String(error));
    });

    return () => { cancelled = true; };
  }, [allowUpstreamResources, bridge, filePath, htmlSource, onPolicyReport, previewEnabled]);

  if (!previewEnabled) {
    return (
      <div className="html-document-view__markdown">
        {conversionError && (
          <div className="html-document-view__error" role="alert">{conversionError}</div>
        )}
        <div dangerouslySetInnerHTML={{ __html: markdownHtml }} />
      </div>
    );
  }

  if (previewError) {
    return <div className="html-document-view__error" role="alert">{previewError}</div>;
  }

  if (!srcDoc) {
    return <div className="html-document-view__loading" role="status">{t.ui.preparingHtmlPreview}</div>;
  }

  return (
    <iframe
      className="html-document-view__iframe"
      sandbox="allow-scripts allow-forms"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      title={title}
    />
  );
});

export function isHtmlDocumentPath(filePath: string | null | undefined): boolean {
  return /\.html?$/i.test(filePath || '');
}
