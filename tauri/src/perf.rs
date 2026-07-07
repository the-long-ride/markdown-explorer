use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

#[derive(Clone)]
pub struct PerfTimer {
    enabled: bool,
    inner: Arc<Mutex<PerfInner>>,
}

struct PerfInner {
    marks: HashMap<String, Instant>,
    renderer_ms: HashMap<String, f64>,
}

impl PerfTimer {
    pub fn new() -> Self {
        Self {
            enabled: std::env::var("MDN_PERF").ok().as_deref() == Some("1"),
            inner: Arc::new(Mutex::new(PerfInner {
                marks: HashMap::new(),
                renderer_ms: HashMap::new(),
            })),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn mark(&self, name: &str) {
        if !self.enabled {
            return;
        }
        let now = Instant::now();
        self.inner.lock().marks.insert(name.to_string(), now);
        eprintln!("[perf] mark {name}");
    }

    pub fn measure(&self, name: &str, start_name: &str) {
        if !self.enabled {
            return;
        }
        let inner = self.inner.lock();
        let Some(&start) = inner.marks.get(start_name) else { return };
        let now = Instant::now();
        let ms = now.duration_since(start).as_millis();
        eprintln!("[perf] {name}: {ms}ms");
    }

    pub fn set_renderer_marks(&self, entries: HashMap<String, f64>) {
        if !self.enabled {
            return;
        }
        let mut inner = self.inner.lock();
        inner.renderer_ms.extend(entries);
    }

    pub fn print_summary(&self) {
        if !self.enabled {
            return;
        }

        let inner = self.inner.lock();
        let marks = &inner.marks;
        let rmarks = &inner.renderer_ms;

        eprintln!("\n[perf] ==== COLD START SUMMARY ====");

        let mut total_start: Option<Instant> = None;
        let mut total_end: Option<Instant> = None;

        let triples: &[(&str, &str, &str)] = &[
            ("Module require", "main:required", "tauri:ready"),
            ("Window create", "tauri:ready", "window:created"),
            (
                "HTML load + renderer boot",
                "window:created",
                "renderer:did-finish-load",
            ),
        ];

        for (label, start_name, end_name) in triples {
            if let (Some(&start), Some(&end)) = (marks.get(*start_name), marks.get(*end_name)) {
                let ms = end.duration_since(start).as_millis();
                eprintln!("[perf]   {label}: {ms}ms");
                if total_start.is_none() {
                    total_start = Some(start);
                }
                total_end = Some(end);
            }
        }

        if let (Some(start), Some(end)) = (total_start, total_end) {
            let ms = end.duration_since(start).as_millis();
            eprintln!("[perf]   TOTAL (main require → renderer load): {ms}ms");
        }

        if let Some(&entry) = rmarks.get("renderer:entry") {
            eprintln!("[perf]   Renderer JS entry: {entry:.0}ms (from nav start)");
        }
        if let Some(&mounted) = rmarks.get("renderer:react-mounted") {
            eprintln!("[perf]   React mounted: {mounted:.0}ms (from nav start)");
        }

        eprintln!("[perf] ================================\n");
    }
}

impl Default for PerfTimer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_by_default() {
        std::env::remove_var("MDN_PERF");
        let timer = PerfTimer::new();
        assert!(!timer.is_enabled());
    }

    #[test]
    fn mark_measure_noop_when_disabled() {
        std::env::remove_var("MDN_PERF");
        let timer = PerfTimer::new();
        timer.mark("test");
        timer.measure("test", "test");
        timer.print_summary();
    }

    static PERF_LOCK: parking_lot::Mutex<()> = parking_lot::Mutex::new(());

    #[test]
    fn enabled_with_env() {
        let _guard = PERF_LOCK.lock();
        std::env::remove_var("MDN_PERF");
        std::env::set_var("MDN_PERF", "1");
        let timer = PerfTimer::new();
        assert!(timer.is_enabled());
        std::env::remove_var("MDN_PERF");
    }

    #[test]
    fn mark_measure_set_renderer_when_enabled() {
        let _guard = PERF_LOCK.lock();
        std::env::remove_var("MDN_PERF");
        std::env::set_var("MDN_PERF", "1");
        let timer = PerfTimer::new();
        assert!(timer.is_enabled());
        timer.mark("main:required");
        timer.mark("tauri:ready");
        timer.mark("window:created");
        timer.mark("renderer:did-finish-load");
        timer.measure("startup", "main:required");

        let mut entries = HashMap::new();
        entries.insert("renderer:entry".to_string(), 50.0);
        entries.insert("renderer:react-mounted".to_string(), 200.0);
        timer.set_renderer_marks(entries);
        timer.print_summary();
        std::env::remove_var("MDN_PERF");
    }

    #[test]
    fn measure_unknown_start_is_noop() {
        let _guard = PERF_LOCK.lock();
        std::env::remove_var("MDN_PERF");
        std::env::set_var("MDN_PERF", "1");
        let timer = PerfTimer::new();
        timer.measure("test", "nonexistent_mark");
        std::env::remove_var("MDN_PERF");
    }

    #[test]
    fn set_renderer_marks_extends_when_enabled() {
        let _guard = PERF_LOCK.lock();
        std::env::remove_var("MDN_PERF");
        std::env::set_var("MDN_PERF", "1");
        let timer = PerfTimer::new();
        let mut entries = HashMap::new();
        entries.insert("key1".to_string(), 10.0);
        timer.set_renderer_marks(entries.clone());
        entries.insert("key2".to_string(), 20.0);
        timer.set_renderer_marks(entries);
        timer.print_summary();
        std::env::remove_var("MDN_PERF");
    }

    #[test]
    fn print_summary_with_partial_marks() {
        let _guard = PERF_LOCK.lock();
        std::env::remove_var("MDN_PERF");
        std::env::set_var("MDN_PERF", "1");
        let timer = PerfTimer::new();
        timer.mark("main:required");
        timer.mark("window:created");
        timer.print_summary();
        std::env::remove_var("MDN_PERF");
    }

    #[test]
    fn set_renderer_marks_noop_when_disabled() {
        std::env::remove_var("MDN_PERF");
        let timer = PerfTimer::new();
        assert!(!timer.is_enabled());
        let mut entries = HashMap::new();
        entries.insert("renderer:entry".to_string(), 100.0);
        timer.set_renderer_marks(entries);
        timer.print_summary();
    }

    #[test]
    fn default_equals_new() {
        std::env::remove_var("MDN_PERF");
        let d = PerfTimer::default();
        let n = PerfTimer::new();
        assert_eq!(d.is_enabled(), n.is_enabled());
    }

    #[test]
    fn print_summary_noop_when_disabled() {
        std::env::remove_var("MDN_PERF");
        let timer = PerfTimer::new();
        timer.print_summary();
        assert!(!timer.is_enabled());
    }
}