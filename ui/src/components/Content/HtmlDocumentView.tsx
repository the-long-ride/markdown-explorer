import { memo, useEffect, useState } from 'react';
import { usePlatform } from '../../contexts/PlatformContext';
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
  onPolicyReport,
}: HtmlDocumentViewProps) {
  const bridge = usePlatform();
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
    }).then((prepared) => {
      if (cancelled) return;
      setSrcDoc(prepared.documentHtml);
      onPolicyReport?.(prepared.policyReport);
    }).catch((error) => {
      if (cancelled) return;
      setPreviewError(error instanceof Error ? error.message : String(error));
    });

    return () => { cancelled = true; };
  }, [bridge, filePath, htmlSource, onPolicyReport, previewEnabled]);

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
    return <div className="html-document-view__loading" role="status">Preparing local HTML preview…</div>;
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
