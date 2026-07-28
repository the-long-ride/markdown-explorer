#![allow(dead_code)]

use tauri::{image::Image, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_window_state::StateFlags;

const APP_ICON_PNG: &[u8] = include_bytes!("../../icons/icon.png");

fn handle_external_open_path(app: &tauri::AppHandle, path: std::path::PathBuf) {
    let state = app.state::<crate::app_state::AppState>();
    if state.inner.read().ready_handled {
        crate::host_message::emit_external_open_path(app, &path.to_string_lossy());
    } else {
        state.inner.write().external_open_path = Some(path);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn boot() {
    let state = crate::app_state::AppState::new();
    state.inner.write().external_open_path =
        crate::runtime::external_open::parse_external_open_path(
            &std::env::args().collect::<Vec<_>>(),
        );
    state.inner.read().perf.mark("main:required");

    let is_packaged = !cfg!(debug_assertions);
    let env_vars: Vec<(String, String)> = std::env::vars().collect();
    let argv: Vec<String> = std::env::args().collect();
    crate::debug_tools::init_debug_mode(is_packaged, &env_vars, &argv);
    let auto_open_devtools = crate::debug_tools::should_auto_open_devtools();

    let state_for_dispatch = state.clone();
    let shim_js = crate::preload::api::electron_api_shim_js().to_string();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let args: Vec<String> = argv.into_iter().collect();
            let Some(path) = crate::runtime::external_open::parse_external_open_path(&args) else {
                return;
            };
            handle_external_open_path(app, path);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                // The custom title bar must remain custom, and fullscreen is transient.
                .with_state_flags(
                    StateFlags::all() & !(StateFlags::FULLSCREEN | StateFlags::DECORATIONS),
                )
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
                    .auto_resize()
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
            let state_for_event = state_for_dispatch.clone();
            window.on_window_event(move |event| match event {
                tauri::WindowEvent::Resized(_) => {
                    let is_max = win_for_event.is_maximized().unwrap_or(false);
                    crate::host_message::emit_window_state_changed(&app_for_event, is_max);

                    let transition = state_for_event.inner.read().fullscreen_transition;
                    match transition {
                        crate::app_state::FullscreenTransition::AwaitingMaximize if is_max => {
                            state_for_event.inner.write().fullscreen_transition =
                                crate::app_state::FullscreenTransition::AwaitingUnmaximize;
                            if win_for_event.unmaximize().is_err() {
                                state_for_event.inner.write().fullscreen_transition =
                                    crate::app_state::FullscreenTransition::Idle;
                            }
                        }
                        crate::app_state::FullscreenTransition::AwaitingUnmaximize if !is_max => {
                            state_for_event.inner.write().fullscreen_transition =
                                crate::app_state::FullscreenTransition::Idle;
                            if win_for_event.set_fullscreen(true).is_ok() {
                                crate::host_message::emit_fullscreen_changed(&app_for_event, true);
                            }
                        }
                        _ => {}
                    }
                }
                tauri::WindowEvent::CloseRequested { .. } => {
                    tauri::async_runtime::spawn(crate::runtime::html_preview::shutdown());
                    if let Ok(config_dir) = app_for_event.path().app_config_dir() {
                        if let Err(err) =
                            crate::update::manager::UpdateManager::apply_pending_update_on_exit(
                                &config_dir,
                            )
                        {
                            eprintln!("warning: failed to launch pending update: {err}");
                        }
                    }
                }
                _ => {}
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            if let Some(path) = urls.into_iter().find_map(|url| url.to_file_path().ok()) {
                handle_external_open_path(app, path);
            }
        }

        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}
