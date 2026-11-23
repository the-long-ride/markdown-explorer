use super::HostApp;
use tauri_plugin_updater::Update;

#[cfg(not(test))]
pub(super) fn install(update: &Update, bytes: &[u8]) -> Result<(), String> {
    update.install(bytes).map_err(|error| error.to_string())
}

#[cfg(test)]
pub(super) fn install(_: &Update, _: &[u8]) -> Result<(), String> {
    Err("native installer is unavailable under MockRuntime".into())
}

#[cfg(not(test))]
pub(super) fn restart(app: &HostApp) -> ! {
    app.restart();
}

#[cfg(test)]
pub(super) fn restart(_: &HostApp) -> ! {
    panic!("MockRuntime cannot restart the process");
}
