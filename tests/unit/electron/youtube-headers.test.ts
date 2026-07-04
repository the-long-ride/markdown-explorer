import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { configureYouTubeEmbedHeaders } = require('../../../desktop/youtube-headers.js');

describe('configureYouTubeEmbedHeaders', () => {
  test('registers webRequest listener for YouTube domains', () => {
    const onBeforeSendHeaders = vi.fn();
    const session = {
      defaultSession: {
        webRequest: { onBeforeSendHeaders },
      },
    };

    configureYouTubeEmbedHeaders(session);

    expect(onBeforeSendHeaders).toHaveBeenCalledTimes(1);
    expect(onBeforeSendHeaders).toHaveBeenCalledWith(
      {
        urls: [
          'https://www.youtube.com/*',
          'https://www.youtube-nocookie.com/*',
        ],
      },
      expect.any(Function),
    );
  });

  describe('header callback', () => {
    let callback: (details: any, cb: (result: any) => void) => void;

    beforeEach(() => {
      const onBeforeSendHeaders = vi.fn((_filter: any, cb: any) => {
        callback = cb;
      });
      const session = {
        defaultSession: {
          webRequest: { onBeforeSendHeaders },
        },
      };
      configureYouTubeEmbedHeaders(session);
    });

    test('adds Referer header when none present', () => {
      const done = vi.fn();
      callback(
        { requestHeaders: { 'Accept-Language': 'en' } },
        done,
      );

      expect(done).toHaveBeenCalledWith({
        requestHeaders: {
          'Accept-Language': 'en',
          Referer: 'https://the-long-ride.github.io/markdown-explorer/',
        },
      });
    });

    test('adds Referer when other headers exist but no referer', () => {
      const done = vi.fn();
      callback(
        { requestHeaders: { 'Accept': '*/*', 'User-Agent': 'test' } },
        done,
      );

      expect(done).toHaveBeenCalledWith({
        requestHeaders: {
          'Accept': '*/*',
          'User-Agent': 'test',
          Referer: 'https://the-long-ride.github.io/markdown-explorer/',
        },
      });
    });

    test('does not add Referer when already present (exact case)', () => {
      const done = vi.fn();
      callback(
        { requestHeaders: { Referer: 'https://existing.example/' } },
        done,
      );

      expect(done).toHaveBeenCalledWith({
        requestHeaders: { Referer: 'https://existing.example/' },
      });
    });

    test('does not add Referer when present with different case (referer lowercase)', () => {
      const done = vi.fn();
      callback(
        { requestHeaders: { referer: 'https://lowercase.example/' } },
        done,
      );

      expect(done).toHaveBeenCalledWith({
        requestHeaders: { referer: 'https://lowercase.example/' },
      });
    });

    test('does not add Referer when present with mixed case (rEfErEr)', () => {
      const done = vi.fn();
      callback(
        { requestHeaders: { rEfErEr: 'https://mixed.example/' } },
        done,
      );

      expect(done).toHaveBeenCalledWith({
        requestHeaders: { rEfErEr: 'https://mixed.example/' },
      });
    });

    test('adds Referer when headers object is empty', () => {
      const done = vi.fn();
      callback(
        { requestHeaders: {} },
        done,
      );

      expect(done).toHaveBeenCalledWith({
        requestHeaders: {
          Referer: 'https://the-long-ride.github.io/markdown-explorer/',
        },
      });
    });

    test('does not duplicate Referer when both cases present', () => {
      const done = vi.fn();
      callback(
        { requestHeaders: { Referer: 'https://a.example/', referer: 'https://b.example/' } },
        done,
      );

      const result = done.mock.calls[0][0];
      expect(result.requestHeaders.Referer).toBe('https://a.example/');
      expect(result.requestHeaders.referer).toBe('https://b.example/');
      // Should not add a third Referer
      const refererKeys = Object.keys(result.requestHeaders).filter((k: string) => k.toLowerCase() === 'referer');
      expect(refererKeys).toHaveLength(2);
    });
  });
});