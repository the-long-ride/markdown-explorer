#[test]
fn tauri_modules_are_linked() {
    let _ = markdown_explorer_tauri_lib::app_state::AppState::new();
}
