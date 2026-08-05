import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const manager = read('tauri/src/update/manager.rs');
const commands = read('tauri/src/dispatcher/commands_window_update.rs');
const bootstrap = read('tauri/src/core/bootstrap.rs');
const cargo = read('tauri/Cargo.toml');
const youtubeProxy = read('tauri/src/youtube.rs');
const config = JSON.parse(read('tauri/tauri.conf.json'));
const releaseWorkflow = read('.github/workflows/release.yml');

test('Tauri initializes official updater and process plugins', () => {
  assert.match(bootstrap, /tauri_plugin_updater::Builder::new\(\)\.build\(\)/);
  assert.match(bootstrap, /tauri_plugin_process::init\(\)/);
});

test('Tauri updater uses signed plugin download and install APIs with progress', () => {
  assert.match(manager, /use tauri_plugin_updater::(?:UpdaterExt|\{[^}]*UpdaterExt[^}]*\})/);
  assert.match(manager, /\.updater\(\)/);
  assert.match(manager, /\.check\(\)\s*\.await/);
  assert.match(manager, /\.download\(/);
  assert.match(manager, /\.install\(/);
  assert.match(manager, /progress_percent/);
  assert.doesNotMatch(manager, /ureq::|std::process::Command|cmd\.exe|create_windows_installer_update_script/);
  assert.match(youtubeProxy, /ureq::get/);
  assert.match(cargo, /^ureq\s*=\s*"2"/m);
});

test('Tauri restart path contains no unreachable success expression', () => {
  assert.doesNotMatch(manager, /app\.restart\(\);\s*Ok\(true\)/);
});

test('Tauri update commands preserve Electron parity', () => {
  for (const command of ['downloadUpdate', 'scheduleDownloadedUpdate', 'restartAndApplyUpdate']) {
    assert.match(commands, new RegExp(`"${command}"`));
  }
  assert.match(commands, /start_download/);
  assert.match(commands, /schedule_downloaded_update/);
  assert.match(commands, /restart_and_apply_update/);
});

test('deferred update is restored and applied through close interception', () => {
  assert.match(manager, /restore_and_emit/);
  assert.match(manager, /apply_scheduled_update/);
  assert.match(bootstrap, /CloseRequested \{ api, \.\. \}/);
  assert.match(bootstrap, /api\.prevent_close\(\)/);
  assert.match(bootstrap, /apply_scheduled_update/);
});

test('Tauri release injects updater signing keys and bundles signed artifacts', () => {
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.equal(config.plugins.updater.active, true);
  assert.equal(config.plugins.updater.pubkey, '__TAURI_UPDATER_PUBLIC_KEY__');
  assert.equal(existsSync(new URL('../../scripts/configure-tauri-updater.mjs', import.meta.url)), true);
  assert.match(releaseWorkflow, /TAURI_UPDATER_PUBLIC_KEY/);
  assert.match(releaseWorkflow, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(releaseWorkflow, /configure-tauri-updater\.mjs/);
  assert.match(releaseWorkflow, /cargo tauri build --bundles app,dmg/);
  assert.match(releaseWorkflow, /nsis\/\*\.exe\.sig/);
  assert.match(releaseWorkflow, /appimage\/\*\.AppImage\.sig/);
  assert.match(releaseWorkflow, /macos\/\*\.app\.tar\.gz/);
  assert.match(releaseWorkflow, /macos\/\*\.app\.tar\.gz\.sig/);
  assert.match(releaseWorkflow, /const signature = `\$\{file\}\.sig`/);
  assert.match(releaseWorkflow, /if-no-files-found: error/);
});
