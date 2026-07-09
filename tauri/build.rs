fn main() {
    tauri_build::build();

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let out_dir = std::env::var("OUT_DIR").unwrap_or_default();

    if target_os != "windows" {
        return;
    }

    // Copy WebView2Loader.dll to output directories to prevent STATUS_ENTRYPOINT_NOT_FOUND
    // when Cloudflare WARP's version shadows the correct one in PATH.
    let target_arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    let arch_dir = match target_arch.as_str() {
        "x86_64" => "x64",
        "x86" => "x86",
        "aarch64" => "arm64",
        _ => &target_arch,
    };

    // OUT_DIR is like target/debug/build/markdown-explorer-tauri-HASH/out
    // Navigate up to target/debug/build and search for webview2-com-sys build output
    let out_dir = std::path::PathBuf::from(&out_dir);
    if let Some(build_dir) = out_dir
        .ancestors()
        .nth(2)
        .filter(|p| p.file_name().map(|n| n == "build").unwrap_or(false))
    {
        if let Ok(entries) = std::fs::read_dir(build_dir) {
            for entry in entries.flatten() {
                let dll_path = entry
                    .path()
                    .join("out")
                    .join(arch_dir)
                    .join("WebView2Loader.dll");
                if dll_path.exists() {
                    let deps_dir = build_dir.parent().map(|p| p.join("deps"));
                    if let Some(deps_dir) = deps_dir {
                        if deps_dir.exists() {
                            let _ = std::fs::copy(&dll_path, deps_dir.join("WebView2Loader.dll"));
                        }
                    }
                    break;
                }
            }
        }
    }
}
