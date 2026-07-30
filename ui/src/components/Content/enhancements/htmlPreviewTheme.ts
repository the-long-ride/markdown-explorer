export function syncHtmlPreviewTheme(root: ParentNode, isDark: boolean): void {
  root.querySelectorAll<HTMLIFrameElement>('.mdn-html-preview-iframe').forEach((iframe) => {
    iframe.contentWindow?.postMessage(
      { type: 'set-theme', theme: isDark ? 'dark' : 'light' },
      '*',
    );
  });
}
