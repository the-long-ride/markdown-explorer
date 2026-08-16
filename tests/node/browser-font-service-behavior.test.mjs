import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inferBrowserFontDescriptor,
  isSupportedBrowserFontFileName,
} from '../../chromium-xtension/src/browser-font-service.ts';

test('browser font imports accept TTF, OTF, WOFF, and WOFF2 only', () => {
  for (const name of ['Demo.ttf', 'Demo.OTF', 'Demo.woff', 'Demo.woff2']) {
    assert.equal(isSupportedBrowserFontFileName(name), true, name);
  }
  for (const name of ['Demo.ttc', 'Demo.otc', 'Demo.eot', 'Demo.txt']) {
    assert.equal(isSupportedBrowserFontFileName(name), false, name);
  }
});

test('browser font descriptor groups family variants from conventional filenames', () => {
  assert.deepEqual(inferBrowserFontDescriptor('JetBrainsMono-Regular.ttf'), {
    family: 'JetBrainsMono',
    style: 'normal',
    weight: 400,
  });
  assert.deepEqual(inferBrowserFontDescriptor('JetBrainsMono-SemiBold-Italic.woff2'), {
    family: 'JetBrainsMono',
    style: 'italic',
    weight: 600,
  });
});
