use super::{error, GitHistoryError, MAX_GIT_OUTPUT_BYTES};
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::time::{Duration, Instant};

/// Same limit as the Electron runner (`GIT_TIMEOUT_MS`).
pub(super) const GIT_TIMEOUT: Duration = Duration::from_secs(20);
const GIT_STDERR_CAPTURE_BYTES: usize = 64 * 1024;
const PIPE_DRAIN_TIMEOUT: Duration = Duration::from_secs(5);

/// Runs Git with a timeout and a hard stdout cap. This blocks: call it from `spawn_blocking`, never
/// straight from the async dispatcher.
pub(super) fn run_git(cwd: &Path, args: &[String]) -> Result<String, GitHistoryError> {
    run_git_limited(cwd, args, GIT_TIMEOUT, MAX_GIT_OUTPUT_BYTES)
}

/// Drains a pipe on its own thread. With an `overflow` flag it stops at the first byte past `limit`
/// (dropping the pipe); without one it keeps draining so the child never blocks but stores at most `limit`.
fn spawn_pipe_reader<R: Read + Send + 'static>(
    reader: Option<R>,
    limit: usize,
    overflow: Option<Arc<AtomicBool>>,
) -> mpsc::Receiver<Vec<u8>> {
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(mut reader) = reader {
            let mut chunk = vec![0u8; 64 * 1024];
            loop {
                match reader.read(&mut chunk) {
                    Ok(0) => break,
                    Ok(read) => {
                        if buffer.len() + read > limit {
                            if let Some(flag) = &overflow {
                                flag.store(true, Ordering::SeqCst);
                                break;
                            }
                            let keep = limit.saturating_sub(buffer.len());
                            buffer.extend_from_slice(&chunk[..keep]);
                            continue;
                        }
                        buffer.extend_from_slice(&chunk[..read]);
                    }
                    Err(err) if err.kind() == std::io::ErrorKind::Interrupted => continue,
                    Err(_) => break,
                }
            }
        }
        let _ = sender.send(buffer);
    });
    receiver
}

pub(super) fn run_git_limited(
    cwd: &Path,
    args: &[String],
    timeout: Duration,
    max_stdout_bytes: usize,
) -> Result<String, GitHistoryError> {
    let mut command = Command::new("git");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: background Git calls must not flash a console window.
        command.creation_flags(0x0800_0000);
    }
    command
        .current_dir(cwd)
        // Emit real UTF-8 paths instead of octal-escaped quoted ones.
        .args(["-c", "core.quotePath=false"])
        .args(args)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|err| {
        // A missing cwd fails the spawn too (NotFound on Unix, an invalid-directory error on Windows);
        // do not blame Git for a deleted folder.
        if !cwd.is_dir() { return error("not-repository", "The workspace folder does not exist"); }
        if err.kind() == std::io::ErrorKind::NotFound {
            error("git-unavailable", "Git executable is unavailable")
        } else {
            error("git-command-failed", err.to_string())
        }
    })?;

    let overflow = Arc::new(AtomicBool::new(false));
    let stdout_reader = spawn_pipe_reader(child.stdout.take(), max_stdout_bytes, Some(overflow.clone()));
    let stderr_reader = spawn_pipe_reader(child.stderr.take(), GIT_STDERR_CAPTURE_BYTES, None);
    let too_large = || error("output-too-large", "Git output exceeded the allowed size");

    let started = Instant::now();
    let mut poll_interval = Duration::from_millis(1);
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {}
            Err(err) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error("git-command-failed", err.to_string()));
            }
        }
        if overflow.load(Ordering::SeqCst) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(too_large());
        }
        if started.elapsed() >= timeout {
            // Do not join the readers here: a grandchild may still hold the pipes open.
            let _ = child.kill();
            let _ = child.wait();
            return Err(error("git-timeout", "Git command timed out"));
        }
        std::thread::sleep(poll_interval);
        poll_interval = (poll_interval * 2).min(Duration::from_millis(20));
    };

    // Git can exit early (broken pipe) after the reader stopped on an oversized stream.
    if overflow.load(Ordering::SeqCst) { return Err(too_large()); }
    let stdout = stdout_reader
        .recv_timeout(PIPE_DRAIN_TIMEOUT)
        .map_err(|_| error("git-command-failed", "Git output stream did not close"))?;
    if overflow.load(Ordering::SeqCst) { return Err(too_large()); }
    if !status.success() {
        let stderr = stderr_reader.recv_timeout(PIPE_DRAIN_TIMEOUT).unwrap_or_default();
        return Err(error("git-command-failed", String::from_utf8_lossy(&stderr).trim().to_owned()));
    }
    Ok(String::from_utf8_lossy(&stdout).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(label: &str) -> std::path::PathBuf {
        let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("md-explorer-git-runner-{label}-{}-{nonce}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn args(values: &[&str]) -> Vec<String> { values.iter().map(|value| (*value).to_owned()).collect() }

    #[test]
    fn oversized_stdout_is_rejected_while_streaming() {
        let dir = temp_dir("big");
        // `git var -l` needs no repository and prints far more than 16 bytes.
        let small = run_git_limited(&dir, &args(&["var", "-l"]), Duration::from_secs(20), 1024 * 1024).unwrap();
        assert!(!small.is_empty());
        let error = run_git_limited(&dir, &args(&["var", "-l"]), Duration::from_secs(20), 16).unwrap_err();
        assert_eq!(error.reason, "output-too-large");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn slow_git_is_killed_at_the_timeout() {
        let dir = temp_dir("slow");
        let started = Instant::now();
        let error = run_git_limited(
            &dir,
            &args(&["-c", "alias.slow=!sleep 5", "slow"]),
            Duration::from_millis(300),
            MAX_GIT_OUTPUT_BYTES,
        ).unwrap_err();
        assert_eq!(error.reason, "git-timeout");
        assert!(started.elapsed() < Duration::from_secs(4), "the timeout must not wait for the child");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn failing_git_reports_stderr_and_lossy_utf8_is_tolerated() {
        let dir = temp_dir("fail");
        let error = run_git_limited(&dir, &args(&["definitely-not-a-git-command"]), Duration::from_secs(20), MAX_GIT_OUTPUT_BYTES).unwrap_err();
        assert_eq!(error.reason, "git-command-failed");
        assert!(!error.message.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_working_directory_is_not_blamed_on_git() {
        let dir = temp_dir("missing");
        std::fs::remove_dir_all(&dir).unwrap();
        let error = run_git(&dir, &args(&["status"])).unwrap_err();
        assert_eq!(error.reason, "not-repository");
    }
}
