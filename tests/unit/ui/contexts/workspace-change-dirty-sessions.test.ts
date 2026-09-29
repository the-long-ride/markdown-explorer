import { describe, expect, test } from 'vitest';
import { initialState, reducer, type AppState } from '../../../../ui/src/contexts/appStateReducer';
import {
  createEditableDocumentSession,
  replaceWorkingSource,
} from '../../../../ui/src/editor/documentSession';

const dirty = replaceWorkingSource(createEditableDocumentSession('/ws-a/dirty.md', '# A', '1:3'), '# A edited');
const clean = createEditableDocumentSession('/ws-a/clean.md', '# C', '1:3');

function stateInWorkspaceA(): AppState {
  return {
    ...initialState,
    workspaceName: 'A',
    workspacePath: '/ws-a',
    documentSessions: {
      '/ws-a/dirty.md': dirty,
      '/ws-a/clean.md': clean,
    },
  };
}

const readyAck = (workspaceName: string, workspacePath?: string) => ({
  type: 'READY_ACK' as const,
  fileList: [],
  tree: null,
  theme: 'light' as const,
  themeStyle: 'default' as const,
  defaultExpanded: true,
  workspaceName,
  workspacePath,
});

describe('unsaved edits survive workspace transitions', () => {
  test('READY_ACK for the same workspace keeps every session', () => {
    const state = stateInWorkspaceA();
    const next = reducer(state, readyAck('A', '/ws-a'));
    expect(next.documentSessions).toEqual(state.documentSessions);
  });

  test('READY_ACK for a different workspace drops clean sessions but keeps dirty ones', () => {
    const next = reducer(stateInWorkspaceA(), readyAck('B', '/ws-b'));
    expect(Object.keys(next.documentSessions)).toEqual(['/ws-a/dirty.md']);
    expect(next.documentSessions['/ws-a/dirty.md']).toBe(dirty);
  });

  test('WORKSPACE_FILES_CHANGED for a different workspace keeps dirty sessions', () => {
    const next = reducer(stateInWorkspaceA(), {
      type: 'WORKSPACE_FILES_CHANGED',
      fileList: [],
      tree: null,
      workspaceName: 'B',
      workspacePath: '/ws-b',
    });
    expect(Object.keys(next.documentSessions)).toEqual(['/ws-a/dirty.md']);
  });

  test('WORKSPACE_FILES_CHANGED for the same workspace keeps every session', () => {
    const state = stateInWorkspaceA();
    const next = reducer(state, {
      type: 'WORKSPACE_FILES_CHANGED',
      fileList: [],
      tree: null,
      workspaceName: 'A',
      workspacePath: '/ws-a',
    });
    expect(next.documentSessions).toEqual(state.documentSessions);
  });

  test('WORKSPACE_UNAVAILABLE (network/USB drop) keeps dirty sessions and drops clean ones', () => {
    const next = reducer(stateInWorkspaceA(), {
      type: 'WORKSPACE_UNAVAILABLE',
      workspacePath: '/ws-a',
      workspaceName: 'A',
      reason: 'notFound',
    });
    expect(Object.keys(next.documentSessions)).toEqual(['/ws-a/dirty.md']);
    expect(next.documentSessions['/ws-a/dirty.md']).toBe(dirty);
    expect(next.contentTabs).toEqual([]);
  });

  test('WORKSPACE_UNAVAILABLE with only clean sessions clears them', () => {
    const state: AppState = { ...stateInWorkspaceA(), documentSessions: { '/ws-a/clean.md': clean } };
    const next = reducer(state, {
      type: 'WORKSPACE_UNAVAILABLE',
      workspacePath: '/ws-a',
      workspaceName: 'A',
      reason: 'notFound',
    });
    expect(next.documentSessions).toEqual({});
  });
});
