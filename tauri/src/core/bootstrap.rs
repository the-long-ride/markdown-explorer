#![allow(dead_code)]

use tauri::{image::Image, DragDropEvent, Manager, WebviewEvent, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_window_state::StateFlags;

const APP_ICON_PNG: &[u8] = include_bytes!("../../icons/icon.png");

fn dispatch_native_drop_event(window: &WebviewWindow, event_type: &str, paths: &[std::path::PathBuf]) {
    let payload = serde_json::json!({
        "type": event_type,
        "paths": paths
            .iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect::<Vec<_>>(),
    });
    let Ok(payload_json) = serde_json::to_string(&payload) else {
        return;
    };
    let script = format!(
        "window.__markdownExplorerHandleNativeDrop?.({payload_json});"
    );
    let _ = window.eval(script);
}

fn handle_external_open_request(
    app: &tauri::AppHandle,
    request: crate::runtime::external_open::ExternalOpenRequest,
) {
    let state = app.state::<crate::app_state::AppState>();
    if state.inner.read().ready_handled {
        crate::runtime::external_open::emit_external_open_request(app, &request);
    } else {
        state.inner.write().external_open_request = Some(request);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn boot() {
    let state = crate::app_state::AppState::new();
    state.inner.write().external_open_request =
        crate::runtime::external_open::parse_external_open_request(
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let args: Vec<String> = argv.into_iter().collect();
            let Some(request) = crate::runtime::external_open::parse_external_open_request(&args) else {
                return;
            };
            handle_external_open_request(app, request);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
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

            // macOS routes Cmd+C/X/V/A and other edit key-equivalents through the
            // application menu's Edit roles (same root cause as Electron issue #42).
            // Without a native menu, WKWebView silently drops those commands for
            // selected text. Windows/Linux keep the frameless no-menu behavior.
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{MenuBuilder, SubmenuBuilder};

                let app_submenu = SubmenuBuilder::new(app, "Markdown Explorer")
                    .about(None)
                    .services()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;
                let edit_submenu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;
                let window_submenu = SubmenuBuilder::new(app, "Window")
                    .minimize()
                    .maximize()
                    .separator()
                    .close_window()
                    .build()?;
                let menu = MenuBuilder::new(app)
                    .item(&app_submenu)
                    .item(&edit_submenu)
                    .item(&window_submenu)
                    .build()?;
                app.set_menu(menu)?;
            }

            let window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("Markdown Explorer")
                    .inner_size(1280.0, 800.0)
                    .min_inner_size(800.0, 480.0)
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

            let win_for_drop = window.clone();
            window.on_webview_event(move |event| {
                let WebviewEvent::DragDrop(drop_event) = event else {
                    return;
                };
                match drop_event {
                    DragDropEvent::Enter { paths, .. } => {
                        dispatch_native_drop_event(&win_for_drop, "over", paths);
                    }
                    DragDropEvent::Over { .. } => {
                        dispatch_native_drop_event(&win_for_drop, "over", &[]);
                    }
                    DragDropEvent::Drop { paths, .. } => {
                        dispatch_native_drop_event(&win_for_drop, "drop", paths);
                    }
                    DragDropEvent::Leave => {
                        dispatch_native_drop_event(&win_for_drop, "leave", &[]);
                    }
                    _ => {}
                }
            });

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
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    tauri::async_runtime::spawn(crate::runtime::html_preview::shutdown());
                    if crate::update::manager::UpdateManager::should_apply_on_close(&state_for_event)
                    {
                        api.prevent_close();
                        let app = app_for_event.clone();
                        let state = state_for_event.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(error) =
                                crate::update::manager::UpdateManager::apply_scheduled_update(
                                    app,
                                    state,
                                )
                                .await
                            {
                                eprintln!("warning: failed to apply scheduled update: {error}");
                            }
                        });
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
            if let Some(request) = urls
                .into_iter()
                .find_map(|url| url.to_file_path().ok())
                .and_then(|path| crate::runtime::external_open::request_for_path(&path))
            {
                handle_external_open_request(app, request);
            }
        }

        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}
