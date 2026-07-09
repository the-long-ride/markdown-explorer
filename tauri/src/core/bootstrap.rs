#![allow(dead_code)]

use tauri::{image::Image, WebviewUrl, WebviewWindowBuilder};

const APP_ICON_PNG: &[u8] = include_bytes!("../../icons/icon.png");

pub fn boot() {
    let state = crate::app_state::AppState::new();
    state.inner.read().perf.mark("main:required");

    let is_packaged = !cfg!(debug_assertions);
    let env_vars: Vec<(String, String)> = std::env::vars().collect();
    let argv: Vec<String> = std::env::args().collect();
    crate::debug_tools::init_debug_mode(is_packaged, &env_vars, &argv);
    let auto_open_devtools = crate::debug_tools::should_auto_open_devtools();

    let state_for_dispatch = state.clone();
    let shim_js = crate::preload::api::electron_api_shim_js().to_string();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&["decorations"])
                .build(),
        )
        .register_uri_scheme_protocol("youtube-proxy", crate::youtube::handle_youtube_proxy)
        .register_uri_scheme_protocol("local-file", crate::local_file::handle_local_file)
        .manage(state)
        .setup(move |app| {
            state_for_dispatch.inner.read().perf.mark("tauri:ready");
            let app_handle = app.handle().clone();
            crate::dispatcher::Dispatcher::mount(&app_handle, state_for_dispatch.clone());

            let window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("Markdown Explorer")
                    .inner_size(1280.0, 800.0)
                    .min_inner_size(720.0, 480.0)
                    .resizable(true)
                    .fullscreen(false)
                    .decorations(false)
                    .initialization_script(&shim_js)
                    .build()?;
            let icon = match Image::from_bytes(APP_ICON_PNG) {
                Ok(img) => img,
                Err(err) => {
                    eprintln!("warning: failed to decode app icon: {err}");
                    return Ok(());
                }
            };
            if let Err(err) = window.set_icon(icon) {
                eprintln!("warning: failed to set window icon: {err}");
            }

            state_for_dispatch.inner.read().perf.mark("window:created");

            if auto_open_devtools {
                crate::debug_tools::open_devtools_if_debug(&window);
            }

            let win_for_event = window.clone();
            let app_for_event = app_handle.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Resized(_) = event {
                    let is_max = win_for_event.is_maximized().unwrap_or(false);
                    crate::host_message::emit_window_state_changed(&app_for_event, is_max);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
