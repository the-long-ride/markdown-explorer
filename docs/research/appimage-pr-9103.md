# AppImage catalog PR #9103 research

Verified 2026-10-16 using public GitHub APIs, official documentation, and the local checkout. No release was built or tested during this research.

## What it is

[PR #9103](https://github.com/AppImage/appimage.github.io/pull/9103) is an automated nomination to the community AppImage catalog. Its single change adds `data/Markdown_Explorer` with the repository URL. Its body says discovery found the v1.7.0 asset `tauri-Markdown.Explorer_amd64.AppImage`; it explicitly says no human tested the entry. The PR remains open. [PR API](https://api.github.com/repos/AppImage/appimage.github.io/pulls/9103), [changed files](https://api.github.com/repos/AppImage/appimage.github.io/pulls/9103/files).

The catalog links to upstream downloads and extracts metadata from the AppImage; it does not distribute the application's binaries itself. The URL-only entry is the expected submission format. [Catalog README](https://github.com/AppImage/appimage.github.io#how-to-submit-appimages-to-the-catalog).

## Why it failed

The [automated test comment](https://github.com/AppImage/appimage.github.io/pull/9103#issuecomment-5903483585) reports that the main executable requires `GLIBC_2.39`, while bundled GTK, Cairo, GLib, WebKit and other libraries require `GLIBC_2.38`. The test host does not provide these symbols, so the application exits before its UI can start. The origin check passed; the application test failed. There are no human reviews in the PR API response. [Checks](https://api.github.com/repos/AppImage/appimage.github.io/commits/c163238a33a0f1b8e5d9a257cd1f7db9f1053352/check-runs).

The catalog's current [test workflow](https://github.com/AppImage/appimage.github.io/blob/master/.github/workflows/test.yml) explicitly uses `runs-on: ubuntu-22.04`. This is the current master configuration; the historical test run was not downloaded or independently reproduced.

## Recommended scoped improvement

1. Pin the Tauri Linux build baseline to `ubuntu-22.04` in both `.github/workflows/release.yml:130` and `.github/workflows/build-all.yml:137`; both used `ubuntu-latest` at the start of this investigation. Keep their existing WebKitGTK 4.1 dependency installation. Rebuild the whole AppImage, including its bundled native dependencies, on that baseline. Current Tauri guidance explicitly lists Ubuntu 22.04 and Debian 12 as suitable oldest-base examples supplying WebKitGTK 4.1. [Tauri AppImage limitations](https://v2.tauri.app/distribute/appimage/#limitations).
2. Partition native build caches by baseline if needed so changing the runner cannot restore binaries produced on a newer Linux base. Verify actual cache behavior before making a cache-specific change.
3. Add meaningful artifact validation: extract the actual generated AppImage, inspect all bundled ELF payload requirements against the selected baseline, and launch the artifact on Ubuntu 22.04 under a virtual display. Confirm a main window is present and survives startup; successful packaging alone is insufficient. AppImage recommends both building on an old enough base and testing on intended target systems. [AppImage best practices](https://docs.appimage.org/reference/best-practices.html#binaries-compiled-on-old-enough-base-system).
4. Publish the rebuilt release through the project's normal human-approved release process, then comment `/retest` on the catalog PR. The bot explicitly requests this after a fixed release. The catalog also tests startup with no network access, so include offline startup in compatibility validation. [Bot report](https://github.com/AppImage/appimage.github.io/pull/9103#issuecomment-5903483585), [catalog submission guidance](https://github.com/AppImage/appimage.github.io#after-you-submit).

The immediate blocker is the Linux native build baseline. Changing the one-line catalog entry or rewriting application features does not address the reported missing symbols. A runner change is well supported by the evidence, but a successful rebuilt AppImage and catalog retest are still required before claiming compatibility is fixed.
