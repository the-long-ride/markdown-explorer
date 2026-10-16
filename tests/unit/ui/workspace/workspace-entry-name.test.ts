import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isProtectedSegment,
  validateWorkspaceEntryName,
  withDefaultExtension,
} from '../../../../ui/src/workspace/workspaceEntryName';

const fixture = JSON.parse(readFileSync(path.resolve(process.cwd(), 'tests/fixtures/workspace-entry-names.json'), 'utf8')) as {
  valid: string[];
  invalid: [string, string][];
};

describe('validateWorkspaceEntryName', () => {
  it.each(fixture.valid)('accepts %j', (name) => {
    expect(validateWorkspaceEntryName(name)).toBeNull();
  });
  it.each(fixture.invalid)('rejects %j as %s', (name, expected) => {
    expect(validateWorkspaceEntryName(name)).toBe(expected);
  });
});

describe('isProtectedSegment', () => {
  it('matches .git ignoring case and trailing dots/spaces', () => {
    expect(isProtectedSegment('.Git. ')).toBe(true);
    expect(isProtectedSegment('.github')).toBe(false);
  });
});

describe('withDefaultExtension', () => {
  it('appends .md to file names without a dot', () => {
    expect(withDefaultExtension('notes', 'file')).toBe('notes.md');
    expect(withDefaultExtension('notes.txt', 'file')).toBe('notes.txt');
    expect(withDefaultExtension('.env', 'file')).toBe('.env');
  });
  it('never changes folder names', () => {
    expect(withDefaultExtension('docs', 'folder')).toBe('docs');
  });
});
