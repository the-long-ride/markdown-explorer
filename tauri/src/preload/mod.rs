pub mod api;

pub fn inject_electron_api_shim(window: &tauri::WebviewWindow) {
    let js = api::electron_api_shim_js();
    if let Err(e) = window.eval(js) {
        eprintln!("failed to inject electronAPI shim: {e}");
    }
}