---
id: skill-bump-version-v-parameter-from-human-will-be-a-versio
type: skill
scope: workspace
tags: [bump, version, parameter, from, human, will, be, in]
created: 2026-06-03
updated: 2026-06-03
author: long.trinh@upheads.no
source: manual
confidence: high
---

# Skill: Bump version v*.*.*. Parameter from human will be a versio

## Context

Approved from a human/agent conversation on 2026-06-03; content is written as objective durable memory.

## Content

- Bump version v*.*.*.
- Parameter from human will be a version in format v*.*.*.
- AI missions: increase version in all package.json, manifest.json, and other files containing a plain *.*.* version using the human input without the v prefix where that file format stores plain versions; update all CHANGELOG.md files; commit all changes as multiple safe split commits; create a new tag for the last commit with tag v*.*.*.
- When the human asks: Bump version v*.*.*, treat the human parameter as the target release tag in format v*.*.*.
- Workflow: update all package.json, manifest.json, and other version-bearing files to the plain version *.*.* where the file format stores versions without the v prefix; update every CHANGELOG.md; commit the release changes as multiple safe split commits; create a Git tag v*.*.* on the last release commit.
- Update all package.json, manifest.json, and other version-bearing files to the plain version *.*.* where the file format stores versions without the v prefix.
- Update every CHANGELOG.md.
- Commit the release changes as multiple safe split commits.


## Example

Use this memory when a future task touches: bump, version, parameter.
