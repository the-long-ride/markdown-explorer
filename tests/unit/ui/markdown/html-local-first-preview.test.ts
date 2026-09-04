import { describe, expect, it } from 'vitest';
import {
  hasHtmlLocalFirstPolicyNotice,
  prepareLocalFirstHtmlPreview,
  type HtmlLocalTextReader,
} from '../../../../ui/src/markdown/htmlLocalFirstPreview';

describe('htmlLocalFirstPreview', () => {
  describe('hasHtmlLocalFirstPolicyNotice', () => {
    it('returns false for empty policy report and true when any items present', () => {
      const empty = {
        blockedRemoteStyles: [],
        blockedRemoteScripts: [],
        allowedRemoteImages: [],
        allowedRemoteFonts: [],
        allowedRemoteMedia: [],
        blockedNetworkApis: [],
        blockedLocalReferences: [],
        missingLocalReferences: [],
      };
      expect(hasHtmlLocalFirstPolicyNotice(empty)).toBe(false);

      expect(hasHtmlLocalFirstPolicyNotice({
        ...empty,
        blockedRemoteStyles: ['https://cdn.example.com/style.css'],
      })).toBe(true);
    });
  });

  describe('prepareLocalFirstHtmlPreview', () => {
    it('inlines local stylesheets and scripts, blocking remote assets and APIs', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <base href="https://malicious.example.com/">
            <link rel="stylesheet" href="https://cdn.example.com/remote.css">
            <link rel="stylesheet" href="local.css">
            <script src="https://cdn.example.com/tracking.js"></script>
            <script src="local.js"></script>
            <script>
              fetch('/api/data');
              new WebSocket('wss://live.com');
            </script>
          </head>
          <body>
            <img src="https://images.example.com/pic.jpg" alt="Remote Image">
            <video src="https://media.example.com/clip.mp4" poster="https://images.example.com/poster.jpg"></video>
            <h1>Hello Local</h1>
          </body>
        </html>
      `;

      const reader: HtmlLocalTextReader = async (resourcePath) => {
        if (resourcePath === 'local.css') {
          return {
            ok: true,
            content: 'body { color: blue; } @import "sub.css"; @import url("https://cdn.example.com/nested.css");',
            resolvedPath: '/workspace/local.css',
          };
        }
        if (resourcePath === 'sub.css') {
          return {
            ok: true,
            content: 'h1 { font-size: 20px; } @import "local.css"; /* circular */',
            resolvedPath: '/workspace/sub.css',
          };
        }
        if (resourcePath === 'local.js') {
          return {
            ok: true,
            content: 'console.log("local script"); navigator.sendBeacon("/log");',
            resolvedPath: '/workspace/local.js',
          };
        }
        return { ok: false, reason: 'not-found' };
      };

      const result = await prepareLocalFirstHtmlPreview({
        htmlSource: html,
        documentPath: '/workspace/index.html',
        readLocalText: reader,
      });

      // Verification:
      expect(result.documentHtml).toContain('<!DOCTYPE html>');
      // Base tag stripped
      expect(result.documentHtml).not.toContain('<base');
      // CSP installed
      expect(result.documentHtml).toContain('Content-Security-Policy');
      // Network guard script installed
      expect(result.documentHtml).toContain('data-mdn-network-guard="true"');

      // Local CSS inlined
      expect(result.documentHtml).toContain('data-mdn-local-resource="/workspace/local.css"');
      expect(result.documentHtml).toContain('body { color: blue; }');
      expect(result.documentHtml).toContain('h1 { font-size: 20px; }');
      expect(result.documentHtml).toContain('skipped circular @import');

      // Local JS inlined
      expect(result.documentHtml).toContain('data-mdn-local-resource="/workspace/local.js"');
      expect(result.documentHtml).toContain('console.log("local script");');

      // Policy report checks:
      expect(result.policyReport.blockedRemoteStyles).toContain('https://cdn.example.com/remote.css');
      expect(result.policyReport.blockedRemoteStyles).toContain('https://cdn.example.com/nested.css');
      expect(result.policyReport.blockedRemoteScripts).toContain('https://cdn.example.com/tracking.js');
      expect(result.policyReport.blockedNetworkApis).toContain('fetch');
      expect(result.policyReport.blockedNetworkApis).toContain('WebSocket');
      expect(result.policyReport.blockedNetworkApis).toContain('sendBeacon');
      expect(result.policyReport.allowedRemoteImages).toContain('https://images.example.com/pic.jpg');
      expect(result.policyReport.allowedRemoteImages).toContain('https://images.example.com/poster.jpg');
      expect(result.policyReport.allowedRemoteMedia).toContain('https://media.example.com/clip.mp4');
    });

    it('reports missing and outside-workspace local resource failures', async () => {
      const html = `
        <html>
          <head>
            <link rel="stylesheet" href="missing.css">
            <script src="../outside.js"></script>
          </head>
        </html>
      `;

      const reader: HtmlLocalTextReader = async (resourcePath) => {
        if (resourcePath === 'missing.css') {
          return { ok: false, reason: 'not-found' };
        }
        return { ok: false, reason: 'outside-workspace' };
      };

      const result = await prepareLocalFirstHtmlPreview({
        htmlSource: html,
        documentPath: '/workspace/doc.html',
        readLocalText: reader,
      });

      expect(result.policyReport.missingLocalReferences).toContain('missing.css');
      expect(result.policyReport.blockedLocalReferences).toContain('../outside.js');
      expect(result.documentHtml).not.toContain('missing.css');
      expect(result.documentHtml).not.toContain('../outside.js');
    });

    it('handles remote font preloads and CSS url() font/image references', async () => {
      const html = `
        <html>
          <head>
            <link rel="preload" href="https://fonts.com/inter.woff2" as="font">
            <style>
              @font-face { font-family: 'Inter'; src: url('https://fonts.com/inter.ttf'); }
            </style>
            <style>
              .bg { background-image: url('https://cdn.com/bg.png'); }
              .audio { background: url('https://cdn.com/sound.mp3'); }
            </style>
          </head>
        </html>
      `;

      const result = await prepareLocalFirstHtmlPreview({
        htmlSource: html,
        documentPath: '/workspace/doc.html',
        readLocalText: async () => ({ ok: false, reason: 'not-found' }),
      });

      expect(result.policyReport.allowedRemoteFonts).toContain('https://fonts.com/inter.woff2');
      expect(result.policyReport.allowedRemoteFonts).toContain('https://fonts.com/inter.ttf');
      expect(result.policyReport.allowedRemoteImages).toContain('https://cdn.com/bg.png');
      expect(result.policyReport.allowedRemoteMedia).toContain('https://cdn.com/sound.mp3');
    });
  });
});
