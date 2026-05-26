# 🧪 Test: Comprehensive Diagram Renderers (Untagged Code Blocks)

This document tests the auto-detection of Mermaid diagrams inside plain code blocks without any `mermaid` language identifier (i.e. using raw ` ``` `). It covers all supported Mermaid keyword starts.

---

## 1. Flowchart (`flowchart`)
```
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

## 2. Classic Graph (`graph`)
```
graph LR
    A[Hard edge] -->|Link text| B(Round edge)
    B --> C{Decision}
    C -->|One| D[Result one]
    C -->|Two| E[Result two]
```

---

## 3. Sequence Diagram (`sequenceDiagram`)
```
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

## 4. Class Diagram (`classDiagram`)
```
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
        +String beakColor
        +swim()
        +quack()
    }
```

---

## 5. State Diagram (`stateDiagram-v2` / `stateDiagram`)
```
stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]
```

---

## 6. Entity Relationship Diagram (`erDiagram`)
```
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
```

---

## 7. User Journey (`journey`)
```
journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      Do work: 1: Me, Cat
    section Go home
      Go downstairs: 5: Me
      Sit on couch: 5: Me
```

---

## 8. Gantt Chart (`gantt`)
```
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

---

## 9. Pie Chart (`pie`)
```
pie title Pets Adopted in 2025
    "Dogs" : 386
    "Cats" : 85
    "Rabbits" : 15
```

---

## 10. Quadrant Chart (`quadrantChart`)
```
quadrantChart
    title Reach and Engagement
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 We should expand
    quadrant-2 Need to promote
    quadrant-3 Re-evaluate
    quadrant-4 Keep monitoring
    "Product A": [0.3, 0.6]
    "Product B": [0.45, 0.23]
    "Product C": [0.57, 0.69]
```

---

## 11. XY Chart (`xychart-beta`)
```
xychart-beta
    title "Sales Growth"
    x-axis ["Jan", "Feb", "Mar", "Apr"]
    y-axis "Revenue ($)" 0 --> 1000
    bar [300, 600, 450, 900]
    line [300, 600, 450, 900]
```

---

## 12. Mindmap (`mindmap`)
```
mindmap
  root((Markdown Explorer))
    Features
      Interactive Sections
      Sortable Tables
      Collapsible Code
      Mermaid Rendering
    Platforms
      VS Code Extension
      Electron App
```

---

## 13. Timeline (`timeline`)
```
timeline
    title Timeline of Markdown Explorer
    2026-05-23 : v1.0.0 Release (Core rendering)
    2026-05-24 : v1.1.1 Release (Math & charts)
    2026-05-25 : v1.3.0 Release (Electron app)
    2026-05-27 : v1.3.5 Release (Mermaid auto-render & list fixes)
```

---

## 14. Git Graph (`gitGraph`)
```
gitGraph
    commit
    commit
    branch hotfix
    checkout hotfix
    commit
    checkout main
    merge hotfix
    commit
```

---

## 15. C4 Diagram (`C4Context`)
```
C4Context
    title System Context diagram for Internet Banking System
    Person(customer, "Banking Customer", "A customer of the bank.")
    System(banking_system, "Internet Banking System", "Allows customers to view accounts.")
    System_Ext(mail_system, "E-mail System", "The internal Microsoft Exchange system.")
    Rel(customer, banking_system, "Uses")
    Rel(banking_system, mail_system, "Sends e-mails using")
```

---

## 16. Sankey Diagram (`sankey-beta`)
```
sankey-beta
    Agricultural waste,Bio-conversion,124
    Bio-conversion,Liquid,50
    Bio-conversion,Solid,74
```

---

## 17. Block Diagram (`block`)
```
block-beta
    columns 3
    A B C
    D:2 E
```

---

## 18. Packet Diagram (`packet-beta`)
```
packet-beta
    0-15: "Source Port"
    16-31: "Destination Port"
    32-63: "Sequence Number"
```

---

## 19. Kanban Board (`kanban`)
```
kanban
    Todo
      Task 1
      Task 2
    In Progress
      Task 3
    Done
      Task 4
```

---

## 20. Architecture Diagram (`architecture-beta`)
```
architecture-beta
    service db(database)[Database]
    service web(internet)[Web Server]
    web:R -- L:db
```

---

## 21. ZenUML (`zenuml`)
```
zenuml
    Alice->Bob: Hello
```

---

## 22. Requirement Diagram (`requirementDiagram`)
```
requirementDiagram
    requirement test_req {
    id: 1
    text: "The system shall render Mermaid graphics offline."
    risk: high
    verifymethod: test
    }
```

---

## 23. Info Block (`info`)
```
info
```
