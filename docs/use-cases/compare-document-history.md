# Use case: compare a Markdown document with its history

Use this workflow when a Markdown file is inside a local Git repository and you need to inspect or compare earlier content without changing the repository.

1. Open the document in Markdown Explorer.
2. Open **More Actions → History**.
3. Select **Load history**. The application checks local Git capability only at this point.
4. Choose one of the document-focused actions:
   - **View revision** to read an older snapshot.
   - **Compare with current** to compare against the last persisted source.
   - **Working copy** to include unsaved in-app edits.
   - Select two commits and choose **Compare selected**.
5. Switch between **Source Diff** and **Rendered Diff** as needed.
6. Choose **Return to current** to leave the read-only History/Diff view.

## Expected behavior

- The current editable document session is not replaced by historical source.
- Historical snapshots cannot be edited or saved in place.
- Git commands are read-only and run locally with structured argument arrays.
- File history follows renames where Git can detect them.
- Chromium and Web show Git as unsupported rather than attempting process execution.
- Conflict comparison still works outside Git repositories because it compares in-memory/disk sources directly.

## When Git is unavailable

The History panel distinguishes between an unsupported browser runtime, a missing local Git executable, and a workspace that is not a Git repository. Normal Markdown reading and editing continue to work independently of Git capability.
