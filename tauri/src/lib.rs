#[cfg(not(test))]
pub mod app_state;
#[cfg(not(test))]
pub mod core;
pub mod debug_tools;
#[cfg(not(test))]
pub mod dispatcher;
#[cfg(test)]
#[path = "dispatcher/document_write.rs"]
mod document_write_test_target;
#[cfg(test)]
#[path = "dispatcher/git_history.rs"]
mod git_history_test_target;
pub mod error;
pub mod fonts;
#[cfg(not(test))]
pub mod host_message;
pub mod insights;
#[path = "insights/external.rs"]
pub mod insights_external;
#[cfg(not(test))]
#[path = "insights/external_host.rs"]
pub mod insights_external_host;
pub mod local_file;
pub mod perf;
#[cfg(not(test))]
pub mod preload;
pub mod render;
pub mod runtime;
pub mod search;
pub mod update;
pub mod workspace;
pub mod youtube;

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    crate::core::bootstrap::boot();
}
