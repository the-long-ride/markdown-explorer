import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTENT_ENHANCEMENT_RETRY_DELAYS_MS,
  CROSS_TAB_RESULT_PAGE_SIZE,
  CUSTOM_THEME_BACKGROUND_BLUR_MAX,
  CUSTOM_THEME_BACKGROUND_OPACITY_MAX,
  CUSTOM_THEME_BACKGROUND_POSITION_MAX_LENGTH,
  CUSTOM_THEME_CONTENT_PADDING_MAX,
  CUSTOM_THEME_CONTENT_PADDING_MIN,
  CUSTOM_THEME_ID_MAX_LENGTH,
  CUSTOM_THEME_NAME_MAX_LENGTH,
  CUSTOM_THEME_RADIUS_MAX,
  CUSTOM_THEME_SECTION_GAP_MAX,
  CUSTOM_THEME_SECTION_GAP_MIN,
  CUSTOM_THEME_STROKE_WIDTH_MAX,
  IMPORTED_KEYBINDING_MAX_LENGTH,
  IMPORTED_LANGUAGE_MAX_LENGTH,
  IMPORTED_LOCAL_UI_MAX_SERIALIZED_LENGTH,
  MAX_BACKGROUND_DATA_URL_LENGTH,
  MAX_CUSTOM_THEMES,
  RECENT_WORKSPACES_MAX_COUNT,
  RECENT_WORKSPACE_NAME_MAX_LENGTH,
  SCOPE_PATH_MAX_LENGTH,
  SCOPE_PATHS_MAX_COUNT,
  SCOPE_WORKSPACE_KEY_MAX_LENGTH,
  MEDIA_ZOOM_BUTTON_STEP,
  MEDIA_ZOOM_MAX,
  MEDIA_ZOOM_MIN,
  MEDIA_ZOOM_WHEEL_STEP,
  TABLE_COLLAPSE_LIMIT,
  TABLE_MAX_WRAPPED_COLUMN_CHARS,
  TABLE_MIN_WRAPPED_COLUMN_CHARS,
} from '../../ui/src/constants/limits.ts';
import {
  CHROMIUM_APP_STATE_STORAGE_KEY,
  DESKTOP_TABS_STORAGE_KEY,
  ELECTRON_APP_STATE_STORAGE_KEY,
  SETTINGS_EXPORT_KIND,
  SETTINGS_EXPORT_SCHEMA_VERSION,
  SIDEBAR_WIDTH_STORAGE_KEY,
  TERMS_ACCEPTED_STORAGE_KEY,
  THEME_ONBOARDING_COMPLETE_STORAGE_KEY,
  TOC_COLLAPSED_STORAGE_KEY,
  TOC_WIDTH_STORAGE_KEY,
  WEB_APP_STATE_STORAGE_KEY,
  WORKSPACE_ALIASES_STORAGE_KEY,
} from '../../ui/src/constants/storage.ts';
import {
  CHANGELOG_URL,
  PRIVACY_POLICY_URL,
  RELEASE_API_URL,
  RELEASE_FALLBACK_URL,
  TERMS_OF_SERVICE_URL,
  VSCODE_MARKETPLACE_URL,
  YOUTUBE_ORIGIN,
  YOUTUBE_WIDGET_REFERRER,
} from '../../ui/src/constants/urls.ts';

test('product limits match the active limits catalog', () => {
  assert.deepEqual(CONTENT_ENHANCEMENT_RETRY_DELAYS_MS, [60, 180, 500, 1000, 2000]);
  assert.equal(CROSS_TAB_RESULT_PAGE_SIZE, 100);
  assert.equal(RECENT_WORKSPACES_MAX_COUNT, 100);
  assert.equal(RECENT_WORKSPACE_NAME_MAX_LENGTH, 120);
  assert.equal(SCOPE_WORKSPACE_KEY_MAX_LENGTH, 1000);
  assert.equal(SCOPE_PATH_MAX_LENGTH, 1000);
  assert.equal(SCOPE_PATHS_MAX_COUNT, 10_000);
  assert.equal(IMPORTED_KEYBINDING_MAX_LENGTH, 48);
  assert.equal(IMPORTED_LANGUAGE_MAX_LENGTH, 12);
  assert.equal(IMPORTED_LOCAL_UI_MAX_SERIALIZED_LENGTH, 350_000);
  assert.equal(TABLE_COLLAPSE_LIMIT, 15);
  assert.equal(TABLE_MIN_WRAPPED_COLUMN_CHARS, 10);
  assert.equal(TABLE_MAX_WRAPPED_COLUMN_CHARS, 28);
  assert.equal(MEDIA_ZOOM_MIN, 0.25);
  assert.equal(MEDIA_ZOOM_MAX, 20);
  assert.equal(MEDIA_ZOOM_BUTTON_STEP, 0.25);
  assert.equal(MEDIA_ZOOM_WHEEL_STEP, 0.15);
  assert.equal(MAX_CUSTOM_THEMES, 24);
  assert.equal(MAX_BACKGROUND_DATA_URL_LENGTH, 900_000);
  assert.equal(CUSTOM_THEME_ID_MAX_LENGTH, 64);
  assert.equal(CUSTOM_THEME_NAME_MAX_LENGTH, 48);
  assert.equal(CUSTOM_THEME_BACKGROUND_POSITION_MAX_LENGTH, 48);
  assert.equal(CUSTOM_THEME_RADIUS_MAX, 18);
  assert.equal(CUSTOM_THEME_STROKE_WIDTH_MAX, 3);
  assert.equal(CUSTOM_THEME_CONTENT_PADDING_MIN, 16);
  assert.equal(CUSTOM_THEME_CONTENT_PADDING_MAX, 64);
  assert.equal(CUSTOM_THEME_SECTION_GAP_MIN, 4);
  assert.equal(CUSTOM_THEME_SECTION_GAP_MAX, 28);
  assert.equal(CUSTOM_THEME_BACKGROUND_OPACITY_MAX, 0.5);
  assert.equal(CUSTOM_THEME_BACKGROUND_BLUR_MAX, 18);
});

test('persistent storage identifiers remain stable', () => {
  assert.equal(ELECTRON_APP_STATE_STORAGE_KEY, 'markdown-explorer-ui-state');
  assert.equal(CHROMIUM_APP_STATE_STORAGE_KEY, 'markdown-explorer-chrome-state');
  assert.equal(WEB_APP_STATE_STORAGE_KEY, 'markdown-explorer-web-state');
  assert.equal(TERMS_ACCEPTED_STORAGE_KEY, 'markdown-explorer-terms-accepted');
  assert.equal(THEME_ONBOARDING_COMPLETE_STORAGE_KEY, 'markdown-explorer-theme-onboarding-complete');
  assert.equal(SIDEBAR_WIDTH_STORAGE_KEY, 'markdown-explorer-sidebar-width');
  assert.equal(TOC_WIDTH_STORAGE_KEY, 'markdown-explorer-toc-width');
  assert.equal(TOC_COLLAPSED_STORAGE_KEY, 'markdown-explorer-toc-collapsed');
  assert.equal(DESKTOP_TABS_STORAGE_KEY, 'markdown-explorer-desktop-tabs-v1');
  assert.equal(WORKSPACE_ALIASES_STORAGE_KEY, 'markdown-explorer-workspace-aliases-v1');
  assert.equal(SETTINGS_EXPORT_KIND, 'markdown-explorer-settings');
  assert.equal(SETTINGS_EXPORT_SCHEMA_VERSION, 1);
});

test('external product URLs are HTTPS and point to approved hosts', () => {
  const urls = [
    RELEASE_API_URL,
    RELEASE_FALLBACK_URL,
    CHANGELOG_URL,
    VSCODE_MARKETPLACE_URL,
    PRIVACY_POLICY_URL,
    TERMS_OF_SERVICE_URL,
    YOUTUBE_WIDGET_REFERRER,
    YOUTUBE_ORIGIN,
  ];
  for (const value of urls) {
    const url = new URL(value);
    assert.equal(url.protocol, 'https:');
    assert.ok([
      'api.github.com',
      'github.com',
      'marketplace.visualstudio.com',
      'the-long-ride.github.io',
    ].includes(url.hostname));
  }
});
