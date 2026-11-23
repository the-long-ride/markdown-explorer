use super::*;
#[cfg(not(test))]
use tauri_plugin_clipboard_manager::ClipboardExt;
#[cfg(not(test))]
use tauri_plugin_opener::OpenerExt;

#[cfg(not(test))]
impl Dispatcher {
    pub(super) fn open_native_path(&self, path: &Path) {
        let _ = self
            .app
            .opener()
            .open_path(path.to_string_lossy().into_owned(), None::<&str>);
    }

    pub(super) fn reveal_native_file(&self, path: &Path) {
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("explorer")
                .arg(format!("/select,{}", path.display()))
                .spawn();
        }
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open")
                .arg("-R")
                .arg(path)
                .spawn();
        }
        #[cfg(target_os = "linux")]
        if let Some(parent) = path.parent() {
            self.open_native_path(parent);
        }
    }

    pub(super) fn open_native_url(&self, url: &str) {
        let _ = self.app.opener().open_url(url, None::<&str>);
    }

    pub(super) fn copy_native_text(&self, text: &str) {
        let _ = self.app.clipboard().write_text(text);
    }
}

#[cfg(test)]
impl Dispatcher {
    fn emit_mock_native_action(&self, action: &str, value: &str) {
        use tauri::Emitter;
        self.app
            .emit(
                "mock-native-action",
                json!({"action":action, "value":value}),
            )
            .unwrap();
    }

    pub(super) fn open_native_path(&self, path: &Path) {
        self.emit_mock_native_action("open-path", &path.to_string_lossy());
    }

    pub(super) fn reveal_native_file(&self, path: &Path) {
        self.emit_mock_native_action("reveal-file", &path.to_string_lossy());
    }

    pub(super) fn open_native_url(&self, url: &str) {
        self.emit_mock_native_action("open-url", url);
    }

    pub(super) fn copy_native_text(&self, text: &str) {
        self.emit_mock_native_action("copy-text", text);
    }
}

#[cfg(not(test))]
impl Dispatcher {
    pub(super) fn pick_folder(&self) -> Option<PathBuf> {
        tauri_plugin_dialog::DialogExt::dialog(&self.app)
            .file()
            .blocking_pick_folder()
            .and_then(|p| p.into_path().ok())
    }

    pub(super) fn pick_file(&self) -> Option<PathBuf> {
        tauri_plugin_dialog::DialogExt::dialog(&self.app)
            .file()
            .blocking_pick_file()
            .and_then(|p| p.into_path().ok())
    }

    pub(super) fn pick_font_file(&self) -> Option<PathBuf> {
        tauri_plugin_dialog::DialogExt::dialog(&self.app)
            .file()
            .add_filter("Fonts", &["ttf", "otf"])
            .blocking_pick_file()
            .and_then(|path| path.into_path().ok())
    }

    pub(super) fn pick_export_path(&self, file_name: String, png_only: bool) -> Option<PathBuf> {
        let dialog = tauri_plugin_dialog::DialogExt::dialog(&self.app)
            .file()
            .set_file_name(file_name);
        let dialog = if png_only {
            dialog.add_filter("PNG", &["png"])
        } else {
            dialog
        };
        dialog
            .blocking_save_file()
            .and_then(|path| path.into_path().ok())
    }
}

#[cfg(test)]
#[derive(Default)]
pub(super) struct MockNativeDialogs(pub Mutex<std::collections::VecDeque<Option<PathBuf>>>);

#[cfg(test)]
impl Dispatcher {
    fn take_mock_dialog_result(&self) -> Option<PathBuf> {
        self.app
            .try_state::<MockNativeDialogs>()
            .and_then(|dialogs| dialogs.0.lock().unwrap().pop_front().flatten())
    }

    pub(super) fn pick_folder(&self) -> Option<PathBuf> {
        self.take_mock_dialog_result()
    }

    pub(super) fn pick_file(&self) -> Option<PathBuf> {
        self.take_mock_dialog_result()
    }

    pub(super) fn pick_font_file(&self) -> Option<PathBuf> {
        self.take_mock_dialog_result()
    }

    pub(super) fn pick_export_path(&self, _: String, _: bool) -> Option<PathBuf> {
        self.take_mock_dialog_result()
    }
}

#[cfg(not(test))]
pub(super) fn os_trash(path: &Path) -> Result<(), &'static str> {
    trash::delete(path).map_err(|_| "failed")
}

#[cfg(test)]
pub(super) fn os_trash(_: &Path) -> Result<(), &'static str> {
    Err("failed")
}
