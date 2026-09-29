//! Native close guard state machine (port of `electron/core/native-close-guard.js`).
//!
//! A close request never closes the window directly. The host prevents the close, sends
//! `nativeCloseRequested { requestId, intent }` to the UI, and waits for the UI to reply with
//! `confirmNativeClose { requestId, intent, cancelled? }`. Only an approved confirmation lets the
//! next close request through.
//!
//! This module is pure (no Tauri types) so the protocol can be unit tested.

use std::time::{Duration, Instant};

/// How long a pending request blocks close attempts. A close requested after this window is allowed,
/// so a dead or reloaded webview can never trap the window open.
pub const PENDING_TIMEOUT: Duration = Duration::from_secs(10);

/// Closing the only window exits the app on every platform Tauri targets.
pub const CLOSE_INTENT: &str = "app";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CloseRequest {
    pub request_id: String,
    pub intent: &'static str,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CloseDecision {
    /// Let the native close proceed.
    Allow,
    /// Prevent the close and (re)send this request to the UI.
    Prevent(CloseRequest),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ConfirmOutcome {
    /// Stale, unknown or mismatching reply.
    Ignored,
    /// The UI cancelled the pending close.
    Cancelled,
    /// The UI approved; the caller must close the window again.
    Approved,
}

#[derive(Debug, Default)]
pub struct CloseGuard {
    pending: Option<(CloseRequest, Instant)>,
    counter: u64,
    allow_next_close: bool,
}

impl CloseGuard {
    /// Called for every native close request (title bar, Alt+F4, in-app `window-close`).
    pub fn on_close_requested(&mut self, now: Instant) -> CloseDecision {
        if self.allow_next_close {
            self.allow_next_close = false;
            return CloseDecision::Allow;
        }
        if let Some((request, requested_at)) = &self.pending {
            if now.saturating_duration_since(*requested_at) < PENDING_TIMEOUT {
                // Re-send: the earlier message may have been lost (webview reloading, prompt dismissed).
                return CloseDecision::Prevent(request.clone());
            }
            // The UI never answered; stop blocking.
            self.pending = None;
            return CloseDecision::Allow;
        }
        self.counter += 1;
        let request = CloseRequest {
            request_id: format!("native-close-{}", self.counter),
            intent: CLOSE_INTENT,
        };
        self.pending = Some((request.clone(), now));
        CloseDecision::Prevent(request)
    }

    /// Handles `confirmNativeClose`.
    pub fn confirm(&mut self, request_id: &str, intent: &str, cancelled: bool) -> ConfirmOutcome {
        let matches = self
            .pending
            .as_ref()
            .is_some_and(|(request, _)| request.request_id == request_id && request.intent == intent);
        if !matches {
            return ConfirmOutcome::Ignored;
        }
        self.pending = None;
        if cancelled {
            return ConfirmOutcome::Cancelled;
        }
        self.allow_next_close = true;
        ConfirmOutcome::Approved
    }

    /// The webview reloaded or crashed: the pending request can no longer be answered.
    pub fn clear_pending(&mut self) {
        self.pending = None;
    }

    pub fn has_pending(&self) -> bool {
        self.pending.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request_id(decision: CloseDecision) -> String {
        match decision {
            CloseDecision::Prevent(request) => request.request_id,
            CloseDecision::Allow => panic!("expected the close to be prevented"),
        }
    }

    #[test]
    fn first_close_is_prevented_and_requests_the_ui() {
        let mut guard = CloseGuard::default();
        let decision = guard.on_close_requested(Instant::now());
        assert_eq!(
            decision,
            CloseDecision::Prevent(CloseRequest { request_id: "native-close-1".into(), intent: "app" })
        );
        assert!(guard.has_pending());
    }

    #[test]
    fn repeated_close_while_pending_resends_the_same_request() {
        let mut guard = CloseGuard::default();
        let now = Instant::now();
        let first = request_id(guard.on_close_requested(now));
        let second = request_id(guard.on_close_requested(now + Duration::from_secs(1)));
        assert_eq!(first, second);
    }

    #[test]
    fn approved_confirmation_allows_exactly_one_close() {
        let mut guard = CloseGuard::default();
        let now = Instant::now();
        let id = request_id(guard.on_close_requested(now));
        assert_eq!(guard.confirm(&id, "app", false), ConfirmOutcome::Approved);
        assert!(!guard.has_pending());
        assert_eq!(guard.on_close_requested(now), CloseDecision::Allow);
        assert!(matches!(guard.on_close_requested(now), CloseDecision::Prevent(_)));
    }

    #[test]
    fn cancelled_confirmation_keeps_the_window_open() {
        let mut guard = CloseGuard::default();
        let now = Instant::now();
        let id = request_id(guard.on_close_requested(now));
        assert_eq!(guard.confirm(&id, "app", true), ConfirmOutcome::Cancelled);
        let next = request_id(guard.on_close_requested(now));
        assert_ne!(id, next, "a cancelled request must not be reused");
    }

    #[test]
    fn mismatching_or_stale_confirmations_are_ignored() {
        let mut guard = CloseGuard::default();
        let now = Instant::now();
        assert_eq!(guard.confirm("native-close-1", "app", false), ConfirmOutcome::Ignored);
        let id = request_id(guard.on_close_requested(now));
        assert_eq!(guard.confirm("other", "app", false), ConfirmOutcome::Ignored);
        assert_eq!(guard.confirm(&id, "window", false), ConfirmOutcome::Ignored);
        assert!(guard.has_pending());
        assert!(matches!(guard.on_close_requested(now), CloseDecision::Prevent(_)));
    }

    #[test]
    fn pending_request_expires_after_the_timeout() {
        let mut guard = CloseGuard::default();
        let now = Instant::now();
        request_id(guard.on_close_requested(now));
        let just_before = now + PENDING_TIMEOUT - Duration::from_millis(1);
        assert!(matches!(guard.on_close_requested(just_before), CloseDecision::Prevent(_)));
        assert_eq!(guard.on_close_requested(now + PENDING_TIMEOUT), CloseDecision::Allow);
        assert!(!guard.has_pending());
    }

    #[test]
    fn clearing_pending_lets_a_fresh_request_start_after_reload() {
        let mut guard = CloseGuard::default();
        let now = Instant::now();
        let old = request_id(guard.on_close_requested(now));
        guard.clear_pending();
        assert_eq!(guard.confirm(&old, "app", false), ConfirmOutcome::Ignored);
        let fresh = request_id(guard.on_close_requested(now));
        assert_ne!(old, fresh);
    }
}
