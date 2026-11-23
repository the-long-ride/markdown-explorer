pub mod app_state;

#[cfg(test)]
type HostApp = tauri::AppHandle<tauri::test::MockRuntime>;
#[cfg(not(test))]
type HostApp = tauri::AppHandle;
#[cfg(not(test))]
pub mod core;
pub mod debug_tools;
pub mod dispatcher;
#[path = "dispatcher/document_write.rs"]
mod document_write;
pub mod error;
pub mod fonts;
#[path = "dispatcher/git_history.rs"]
mod git_history;
pub mod host_message;
pub mod insights;
#[path = "insights/external.rs"]
pub mod insights_external;
#[path = "insights/external_host.rs"]
pub mod insights_external_host;
pub mod local_file;
pub mod perf;
pub mod preload;
pub mod render;
pub mod runtime;
pub mod search;
pub mod update;
pub mod workspace;
#[path = "dispatcher/workspace_entry_operations.rs"]
mod workspace_entry_operations;
pub mod youtube;

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    crate::core::bootstrap::boot();
}
