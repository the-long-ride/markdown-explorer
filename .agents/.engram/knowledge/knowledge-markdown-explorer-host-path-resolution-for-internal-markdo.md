---
id: knowledge-markdown-explorer-host-path-resolution-for-internal-markdo
type: knowledge
scope: workspace
tags: [markdown-explorer, host, path, resolution, for, internal, markdown, navigation]
created: 2026-06-03
updated: 2026-06-03
author: unknown
source: manual
confidence: high
---

# Knowledge: markdown-explorer host path resolution for internal markdo

## Context

Approved from a human/agent conversation on 2026-06-03; content is written as objective durable memory.

## Content

- markdown-explorer host path resolution for internal markdown navigation lives in desktop/main.js and vscode/src/core/panel.ts; / resolves from the active workspace root while ./ and ../ resolve from the current file directory, preserving absolute sidebar/search paths.


## Example

Use this memory when a future task touches: markdown-explorer, host, path.
