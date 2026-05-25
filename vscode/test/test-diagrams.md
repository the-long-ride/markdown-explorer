# 🧪 Test: Diagram Renderers

This document tests the integration of Mermaid.js rendering including flowcharts, sequence diagrams, class diagrams, state diagrams, and gantt charts.

---

## 1. Flowchart

```mermaid
flowchart TD
    Start --> Ingest[Ingest Raw CSV]
    Ingest --> Check{Is Valid?}
    Check -- Yes --> Transform[Transform and Map fields]
    Check -- No --> Error[Log error & alert]
    Transform --> DB[(Save to PostgreSQL)]
    Error --> Stop([Terminated])
    DB --> Stop
```

---

## 2. Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Extension as VS Code Extension
    participant Webview as Documents Webview
    
    User->>Extension: Execute Command
    Extension->>Webview: Initialize Webview panel
    Webview-->>Extension: Ready Ack
    Extension->>Webview: Send rendered HTML contents
    Webview->>User: Display interactive document
```

---

## 3. Gantt Chart

```mermaid
gantt
    title Deployment Schedule
    dateFormat  YYYY-MM-DD
    section Preparation
    Design & Planning :done, 2026-05-18, 2d
    Coding & Tests     :active, 2026-05-20, 3d
    section Deployment
    Staging Deploy     : 2026-05-23, 1d
    UAT Testing        : 2026-05-24, 2d
    Production Release : 2026-05-26, 1d
```
