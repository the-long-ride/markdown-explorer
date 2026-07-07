fn main() {
    tauri_build::build();

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
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
                let dll_path = entry.path().join("out").join(arch_dir).join("WebView2Loader.dll");
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

    let manifest_xml = std::path::PathBuf::from(&manifest_dir)
        .join("windows-app-manifest.xml");

    if !manifest_xml.exists() {
        std::fs::write(
            &manifest_xml,
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
</assembly>
"#,
        )
        .expect("failed to write windows-app-manifest.xml");
    }

    println!("cargo:rerun-if-changed={}", manifest_xml.display());

    if target_env == "msvc" {
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg=/MANIFESTINPUT:{}",
            manifest_xml.to_str().unwrap()
        );
    } else if target_env == "gnu" {
        let rc_file = std::path::PathBuf::from(&out_dir).join("manifest.rc");
        std::fs::write(
            &rc_file,
            format!("1 24 \"{}\"", manifest_xml.to_str().unwrap().replace('\\', "/")),
        )
        .expect("failed to write manifest.rc");

        let obj_file = std::path::PathBuf::from(&out_dir).join("manifest_resource.o");
        let status = std::process::Command::new("windres")
            .arg("--input")
            .arg(&rc_file)
            .arg("--output")
            .arg(&obj_file)
            .arg("-O")
            .arg("coff")
            .status();

        match status {
            Ok(s) if s.success() => {
                println!(
                    "cargo:rustc-link-arg={}",
                    obj_file.to_str().unwrap()
                );
            }
            _ => {
                println!("cargo:warning=windres failed to compile manifest resource");
            }
        }
    }
}
