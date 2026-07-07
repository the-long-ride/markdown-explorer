pub mod error;
pub mod workspace;
pub mod search;
pub mod runtime;
pub mod perf;
pub mod render;
pub mod youtube;
pub mod debug_tools;
pub mod local_file;
#[cfg(not(test))]
pub mod app_state;
#[cfg(not(test))]
pub mod core;
#[cfg(not(test))]
pub mod dispatcher;
#[cfg(not(test))]
pub mod preload;
pub mod update;
#[cfg(not(test))]
pub mod host_message;

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    crate::core::bootstrap::boot();
}
