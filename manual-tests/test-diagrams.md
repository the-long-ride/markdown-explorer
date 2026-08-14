# 🧪 Test: Comprehensive Diagram Renderers (Untagged Code Blocks)

This document tests the auto-detection of Mermaid diagrams inside plain code blocks without any `mermaid` language identifier (i.e. using raw ` ``` `). It covers all supported Mermaid keyword starts with readability-focused stress cases.

---

## 1. Flowchart (`flowchart`)
```
flowchart LR
    subgraph Sources[Input Sources]
        Upload[Local Markdown File]
        Search[Workspace Search Result]
        Link[Deep Link]
    end
    subgraph Pipeline[Rendering Pipeline]
        Parse[Parse Markdown] --> Detect{Diagram detected?}
        Detect -->|Yes| Theme[Resolve Theme Tokens]
        Detect -->|No| Code[Render Code Block]
        Theme --> Mermaid[Render Mermaid SVG]
        Mermaid --> Contrast[Repair Text Contrast]
        Contrast --> Fit[Fit SVG ViewBox]
    end
    Upload --> Parse
    Search --> Parse
    Link --> Parse
    Fit --> Preview[Interactive Preview]
    Code --> Preview
    Mermaid -. render error .-> Fallback[Restore Source Code]
    Fallback --> Preview
```

---

## 2. Classic Graph (`graph`)
```
graph TB
    Reader([Reader]) -->|opens| Explorer[Markdown Explorer]
    Explorer --> Parser{Content type}
    Parser -->|Markdown| Markdown[Markdown renderer]
    Parser -->|CSV or TSV| Table[Interactive table]
    Parser -->|Mermaid| Diagram[Diagram renderer]
    Diagram --> SVG[(SVG output)]
    Markdown --> Preview[Document preview]
    Table --> Preview
    SVG --> Preview
    Preview -->|theme change| Diagram
    Preview -->|font change| Diagram
```

---

## 3. Sequence Diagram (`sequenceDiagram`)
```
sequenceDiagram
    actor User
    participant UI as Markdown Explorer UI
    participant Renderer as Document Renderer
    participant Mermaid as Mermaid Engine
    participant Cache as Render Cache

    User->>UI: Open document
    UI->>Renderer: Render current Markdown
    Renderer->>Cache: Lookup parsed document
    alt Cached document exists
        Cache-->>Renderer: Parsed blocks
    else Cache miss
        Renderer->>Renderer: Parse Markdown blocks
        Renderer->>Cache: Store parsed blocks
    end
    loop Every Mermaid block
        Renderer->>Mermaid: Render source with theme and font
        Mermaid-->>Renderer: SVG
        Renderer->>Renderer: Apply contrast and layout repair
    end
    Renderer-->>UI: Rendered document
    UI-->>User: Display preview
    opt Theme or Mermaid font changes
        UI->>Renderer: Invalidate visible Mermaid diagrams
        Renderer->>Mermaid: Re-render current document diagrams
    end
```

---

## 4. Class Diagram (`classDiagram`)
```
classDiagram
    direction LR
    class DocumentRenderer {
        +render(markdown)
        +invalidateDiagrams()
    }
    class MermaidRenderer {
        +render(source, theme)
        +fitSvg(svg)
        +repairContrast(svg)
    }
    class ThemeResolver {
        +readTokens()
        +chooseForeground(fill)
    }
    class FontBinding {
        +resolveMermaidFont()
        +applyToC4(svg)
    }
    class DiagramProfile {
        +kind
        +spacing
        +intrinsicWidth
    }
    DocumentRenderer *-- MermaidRenderer : owns
    MermaidRenderer --> ThemeResolver : resolves colors
    MermaidRenderer --> FontBinding : binds typography
    MermaidRenderer o-- DiagramProfile : uses family profile
    ThemeResolver ..> DiagramProfile : supplies accent
```

---

## 5. State Diagram (`stateDiagram-v2` / `stateDiagram`)
```
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : open document
    state Loading {
        [*] --> Parsing
        Parsing --> Enhancing : blocks parsed
        Enhancing --> [*] : SVGs ready
    }
    Loading --> Ready : render complete
    Loading --> Error : render failed
    Ready --> Refreshing : theme or font changed
    state Refreshing {
        [*] --> Invalidating
        Invalidating --> Rerendering
        Rerendering --> [*]
    }
    Refreshing --> Ready : latest run wins
    Ready --> Idle : close document
    Error --> Loading : retry
    Error --> Idle : show source fallback
```

---

## 6. Entity Relationship Diagram (`erDiagram`)
```
erDiagram
    USER {
        string id PK
        string display_name
        string locale
    }
    WORKSPACE {
        string id PK
        string owner_id FK
        string root_path
    }
    DOCUMENT {
        string id PK
        string workspace_id FK
        string relative_path
        datetime updated_at
    }
    THEME {
        string id PK
        string owner_id FK
        string color_mode
        string mermaid_font
    }
    BOOKMARK {
        string id PK
        string document_id FK
        string target
    }
    USER ||--o{ WORKSPACE : owns
    USER ||--o{ THEME : configures
    WORKSPACE ||--o{ DOCUMENT : contains
    DOCUMENT ||--o{ BOOKMARK : exposes
    THEME }o--o{ DOCUMENT : styles
```

---

## 7. User Journey (`journey`)
```
journey
    title Reading and refining a technical document
    section Discover
      Search workspace: 4: Reader
      Open matching document: 5: Reader
      Scan table of contents: 4: Reader
    section Understand
      Read rendered Markdown: 5: Reader
      Inspect Mermaid diagram: 4: Reader, Author
      Expand code example: 4: Reader
      Follow internal link: 5: Reader
    section Refine
      Switch dark mode: 5: Reader
      Change Mermaid font: 4: Reader
      Recheck diagram contrast: 5: Reader, Author
    section Share
      Copy section link: 4: Reader
      Export rendered view: 5: Reader
```

---

## 8. Gantt Chart (`gantt`)
```
gantt
    title Markdown Explorer Release Train
    dateFormat YYYY-MM-DD
    axisFormat %b %d
    section Discovery
    UX review and renderer audit          :done, discover, 2026-05-18, 3d
    Theme token mapping                   :done, theme, after discover, 2d
    section Implementation
    Mermaid contrast engine               :done, contrast, after theme, 3d
    Adaptive Gantt layout                 :active, ganttwork, after contrast, 3d
    C4 typography coverage                :c4font, after contrast, 2d
    Architecture label repair             :archfix, after ganttwork, 2d
    section Verification
    Cross-theme visual regression         :verify, after archfix, 3d
    VS Code and desktop smoke tests        :smoke, after verify, 2d
    Release approval                      :crit, milestone, gate, after smoke, 0d
    section Delivery
    Production package                    :package, after gate, 1d
    Post-release observation              :observe, after package, 3d
```

### 8b. Wide Deployment Schedule (readability regression)
```
gantt
    title Wide Deployment Schedule - Long Labels and Dense Dependencies
    dateFormat YYYY-MM-DD
    axisFormat %b %d
    excludes weekends
    section Product and Architecture
    Product discovery and stakeholder alignment                  :done, discovery, 2026-05-04, 5d
    Architecture constraints and release dependency planning     :done, architecture, after discovery, 5d
    Security and privacy design review                            :done, security, after architecture, 4d
    section Engineering
    Core renderer implementation and integration coverage         :done, core, after security, 8d
    Theme-aware contrast and semantic palette validation          :active, themecheck, after core, 6d
    C4 custom typography binding across every label category      :c4, after core, 5d
    Architecture service label collision regression fixes         :arch, after themecheck, 4d
    section Release Qualification
    Full desktop and VS Code integration regression suite         :qa, after arch, 6d
    Accessibility review for light dark and custom themes         :a11y, after qa, 4d
    Customer acceptance and release sign-off                      :accept, after a11y, 3d
    Production release decision                                   :crit, milestone, release, after accept, 0d
    section Follow-up
    Production monitoring rollback and incident observation       :monitor, after release, 5d
    Post-release metrics review and documentation refresh          :docs, after monitor, 4d
```

---

## 9. Pie Chart (`pie`)
```
pie showData
    title Preview Renderer Workload
    "Markdown" : 42
    "Mermaid" : 24
    "Tables" : 13
    "Code" : 11
    "Math" : 6
    "Media" : 4
```

---

## 10. Quadrant Chart (`quadrantChart`)
```
quadrantChart
    title Renderer Priority by User Value and Maintenance Cost
    x-axis Low User Value --> High User Value
    y-axis Low Maintenance Cost --> High Maintenance Cost
    quadrant-1 Strategic investments
    quadrant-2 Simplify carefully
    quadrant-3 Deprioritize
    quadrant-4 Fast improvements
    Markdown core: [0.92, 0.78]
    Mermaid diagrams: [0.88, 0.72]
    Search preview: [0.82, 0.55]
    CSV tables: [0.64, 0.34]
    Syntax highlighting: [0.72, 0.28]
    Custom themes: [0.58, 0.66]
    Legacy export: [0.30, 0.74]
    Welcome tips: [0.38, 0.22]
```

---

## 11. XY Chart (`xychart-beta`)
```
xychart-beta
    title "Renderer Performance Across Document Sizes"
    x-axis ["10 KB", "50 KB", "100 KB", "250 KB", "500 KB", "1 MB"]
    y-axis "Render time (ms)" 0 --> 1400
    bar [70, 130, 220, 410, 760, 1250]
    bar [55, 115, 190, 350, 640, 1080]
    line [65 "baseline", 120, 205, 380, 700, 1160 "optimized"]
    line [90, 145, 240, 450, 820, 1320]
```

---

## 12. Mindmap (`mindmap`)
```
mindmap
  root((Markdown Explorer))
    Reading
      Navigation
        Table of contents
        Heading anchors
        Back and forward history
      Rich content
        Mermaid diagrams
          Theme-aware colors
          Custom Mermaid font
          Live light dark rerender
        Math rendering
        Interactive tables
    Workspace
      Search
        Focused files
        Live preview
      Bookmarks
        Heading targets
        Object targets
    Platforms
      VS Code Extension
      Electron Desktop
      Tauri Desktop
```

---

## 13. Timeline (`timeline`)
```
timeline
    title Markdown Explorer Renderer Evolution
    section Foundation
        2026 Q1 : Markdown rendering : Syntax highlighting
        2026 Q2 : Interactive tables : Math preview
    section Diagram Expansion
        2026 May : Mermaid auto-detection : Desktop renderer parity
        2026 Jun : Theme-aware SVG rendering : Live color-mode rerender
    section Readability
        2026 Jul : Typography settings : Custom local fonts
        2026 Aug : Neutral-first palette : Adaptive Gantt width
                 : C4 font coverage : Architecture label repair
```

---

## 14. Git Graph (`gitGraph`)
```
gitGraph
    commit id: "baseline" tag: "v1.6.2"
    branch develop
    commit id: "theme-tokens"
    branch mermaid-readability
    commit id: "contrast" type: HIGHLIGHT
    commit id: "gantt-width"
    commit id: "c4-font"
    checkout develop
    commit id: "settings-copy"
    merge mermaid-readability id: "merge-readability"
    branch release
    commit id: "release-candidate" tag: "rc.1"
    checkout develop
    branch hotfix
    commit id: "vsix-types" type: REVERSE
    checkout release
    merge hotfix id: "merge-hotfix"
    checkout main
    merge release id: "ship" tag: "v1.6.3" type: HIGHLIGHT
```

---

## 15. C4 Diagram (`C4Context`)
```
C4Context
    title Markdown Explorer System Context
    Person(reader, "Reader", "Reads technical Markdown documentation.")
    Person(author, "Author", "Maintains Markdown and diagram sources.")
    System_Boundary(mdx, "Markdown Explorer") {
        System(viewer, "Document Viewer", "Renders Markdown and interactive content.")
        System(renderer, "Mermaid Renderer", "Produces theme-aware SVG diagrams.")
        SystemDb(settings, "Local Settings", "Stores theme and typography preferences.")
    }
    System_Ext(editor, "External Editor", "Edits source files.")
    System_Ext(os, "Operating System", "Provides system light and dark preference.")
    Rel(reader, viewer, "Reads documents")
    Rel(author, editor, "Edits source")
    Rel(editor, viewer, "Opens updated Markdown")
    Rel(viewer, renderer, "Renders diagram source")
    Rel(renderer, settings, "Reads Mermaid font and theme")
    Rel(os, viewer, "Signals color-mode changes")
```

---

## 16. Sankey Diagram (`sankey-beta`)
```
sankey-beta
    Markdown source,Block parser,100
    Block parser,Markdown renderer,48
    Block parser,Mermaid renderer,28
    Block parser,Table renderer,14
    Block parser,Math renderer,10
    Mermaid renderer,Theme resolver,28
    Theme resolver,SVG post processing,28
    Markdown renderer,Document preview,48
    Table renderer,Document preview,14
    Math renderer,Document preview,10
    SVG post processing,Document preview,28
```

---

## 17. Block Diagram (`block`)
```
block-beta
    columns 4
    Source["Markdown Source"] Theme["Theme Tokens"] Font["Mermaid Font"] space
    block:pipeline:3
        Parse["Parse"] Detect["Detect Diagram"] Render["Render SVG"]
    end
    Preview["Preview"] Export["Export"] space:2
    Source --> Parse
    Parse -- "AST" --> Detect
    Detect --> Render
    Theme --> Render
    Font --> Render
    Render -- "SVG" --> Preview
    Render --> Export
```

---

## 18. Packet Diagram (`packet-beta`)
```
packet-beta
    title Simplified IPv4 Header
    +4: "Version"
    +4: "IHL"
    +6: "DSCP"
    +2: "ECN"
    +16: "Total Length"
    +16: "Identification"
    +3: "Flags"
    +13: "Fragment Offset"
    +8: "TTL"
    +8: "Protocol"
    +16: "Header Checksum"
    +32: "Source Address"
    +32: "Destination Address"
```

---

## 19. Kanban Board (`kanban`)
```
kanban
    backlog[Backlog]
        themeAudit[Audit Mermaid theme contrast]@{ assigned: 'Mina', ticket: MDX-214, priority: 'High' }
        ganttWidth[Adaptive Gantt intrinsic width]@{ assigned: 'Kai', ticket: MDX-219, priority: 'Very High' }
        c4Fonts[Complete C4 font binding]@{ assigned: 'Linh', ticket: MDX-221, priority: 'High' }
    active[In Progress]
        architecture[Repair architecture labels]@{ assigned: 'Mina', ticket: MDX-223, priority: 'High' }
        fixtures[Expand Mermaid fixtures]@{ assigned: 'Kai', ticket: MDX-224, priority: 'Low' }
    review[Ready for Review]
        liveTheme[Live theme rerender]@{ assigned: 'Linh', ticket: MDX-208, priority: 'High' }
    verify[Verification]
        darkMode[Dark theme visual pass]@{ assigned: 'Mina', priority: 'High' }
        customTheme[Custom theme visual pass]@{ assigned: 'Kai', priority: 'High' }
    done[Done]
        fontSetting[Mermaid typography setting]@{ assigned: 'Linh', ticket: MDX-205, priority: 'Low' }
```

---

## 20. Architecture Diagram (`architecture-beta`)
```
architecture-beta
    group clients(cloud)[Client Layer]
    group app(cloud)[Application Layer]
    group data(cloud)[Data Layer]
    service browser(internet)[Document Reader] in clients
    service extension(server)[VS Code Extension] in clients
    service viewer(server)[Document Viewer] in app
    service worker(server)[Render Worker] in app
    service database(database)[Metadata Database] in data
    service cache(disk)[Render Cache] in data
    junction ingress in app
    browser:R -- L:ingress
    extension:R -- L:ingress
    ingress:R --> L:viewer
    ingress:B --> T:worker
    viewer:R --> L:database
    worker:R --> L:cache
    align column browser extension
```

---

## 21. ZenUML (`zenuml`)
```
zenuml
    title Theme-aware Mermaid Rendering
    @Actor User
    Preview
    Renderer
    @Database Cache
    User->Preview: Open Markdown document
    Preview.RenderDocument() {
        Renderer.RenderMermaid() {
            Cache.lookup()
            if(cacheHit) {
                return cachedSvg
            } else {
                Renderer->Cache: Store fresh SVG
                return freshSvg
            }
        }
    }
    while(themeChanges) {
        User->Preview: Switch color mode
        Preview.RenderDocument()
    }
```

---

## 22. Requirement Diagram (`requirementDiagram`)
```
requirementDiagram
    direction LR
    requirement readable_svg {
        id: 1
        text: "Rendered Mermaid text shall remain readable in every theme."
        risk: high
        verifymethod: test
    }
    functionalRequirement live_rerender {
        id: 1.1
        text: "Visible diagrams shall rerender when theme or Mermaid font changes."
        risk: medium
        verifymethod: test
    }
    performanceRequirement wide_gantt {
        id: 1.2
        text: "Dense Gantt charts shall preserve readable intrinsic width."
        risk: medium
        verifymethod: demonstration
    }
    element renderer_tests {
        type: "automated test suite"
        docref: "tests/node/mermaid-rendering-quality.test.mjs"
    }
    element manual_suite {
        type: "manual renderer fixture"
        docref: "manual-tests/test-diagrams.md"
    }
    renderer_tests - verifies -> readable_svg
    renderer_tests - verifies -> live_rerender
    manual_suite - verifies -> wide_gantt
    readable_svg - traces -> live_rerender
    live_rerender - refines -> wide_gantt
```

---

## 23. Info Block (`info`)
```
info
```
