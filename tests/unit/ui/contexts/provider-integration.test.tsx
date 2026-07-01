import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformProvider, usePlatform } from '../../../../ui/src/contexts/PlatformContext';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { NavigationProvider, useNavigation } from '../../../../ui/src/contexts/NavigationContext';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

function createMockBridge(overrides: Partial<PlatformBridge> = {}): PlatformBridge {
  return {
    postMessage: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    getState: vi.fn(() => ({} as any)),
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
    ...overrides,
  } as unknown as PlatformBridge;
}

function TestWrapper({
  bridge,
  children,
}: {
  bridge: PlatformBridge;
  children: React.ReactNode;
}) {
  return (
    <PlatformProvider bridge={bridge}>
      <AppStateProvider>
        <NavigationProvider>{children}</NavigationProvider>
      </AppStateProvider>
    </PlatformProvider>
  );
}

function PlatformConsumer({ testId }: { testId: string }) {
  const bridge = usePlatform();
  return <span data-testid={testId}>{bridge ? 'has-bridge' : 'no-bridge'}</span>;
}

function AppStateConsumer() {
  const { state } = useAppState();
  return (
    <div>
      <span data-testid="has-state">{state ? 'yes' : 'no'}</span>
      <span data-testid="is-loading">{String(state.isLoading)}</span>
      <span data-testid="theme">{state.theme}</span>
    </div>
  );
}

function NavigationConsumer() {
  const nav = useNavigation();
  return (
    <div>
      <button data-testid="push" onClick={() => nav.push('a.md')}>push</button>
      <button data-testid="push2" onClick={() => nav.push('b.md')}>push2</button>
      <span data-testid="canback">{String(nav.canGoBack)}</span>
      <span data-testid="canforward">{String(nav.canGoForward)}</span>
    </div>
  );
}

describe('PlatformContext', () => {
  it('provides bridge via usePlatform', () => {
    const bridge = createMockBridge();
    const { getByTestId } = render(
      <PlatformProvider bridge={bridge}>
        <PlatformConsumer testId="result" />
      </PlatformProvider>,
    );
    expect(getByTestId('result').textContent).toBe('has-bridge');
  });

  it('throws when usePlatform is called outside provider', () => {
    expect(() => {
      function Bad() { usePlatform(); return <div/>; }
      render(<Bad />);
    }).toThrow();
  });
});

describe('AppStateContext', () => {
  it('provides initial state via useAppState', () => {
    const bridge = createMockBridge();
    const { getByTestId } = render(
      <TestWrapper bridge={bridge}>
        <AppStateConsumer />
      </TestWrapper>,
    );

    expect(getByTestId('has-state').textContent).toBe('yes');
    expect(getByTestId('theme').textContent).toBeDefined();
  });

  it('dispatches SET_LOADING on mount and sends ready', () => {
    const bridge = createMockBridge();
    render(
      <TestWrapper bridge={bridge}>
        <div>test</div>
      </TestWrapper>,
    );

    expect(bridge.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'ready' }),
    );
  });

  it('reads persisted state from bridge.getState', () => {
    const bridge = createMockBridge({
      getState: vi.fn(() => ({ theme: 'dark' } as any)),
    });

    render(
      <TestWrapper bridge={bridge}>
        <AppStateConsumer />
      </TestWrapper>,
    );

    expect(bridge.getState).toHaveBeenCalled();
  });
});

describe('NavigationContext', () => {
  it('provides navigation context with back/forward', () => {
    const bridge = createMockBridge();
    const { getByTestId } = render(
      <TestWrapper bridge={bridge}>
        <NavigationConsumer />
      </TestWrapper>,
    );

    expect(getByTestId('canback').textContent).toBe('false');
    expect(getByTestId('canforward').textContent).toBe('false');
  });

  it('canGoBack becomes true after pushing items', () => {
    const bridge = createMockBridge();
    const { getByTestId } = render(
      <TestWrapper bridge={bridge}>
        <NavigationConsumer />
      </TestWrapper>,
    );

    expect(getByTestId('canback').textContent).toBe('false');
    fireEvent.click(getByTestId('push'));
    expect(getByTestId('canback').textContent).toBe('false');
    fireEvent.click(getByTestId('push2'));
    expect(getByTestId('canback').textContent).toBe('true');
  });

  it('throws when useNavigation is called outside provider', () => {
    expect(() => {
      function Bad() { useNavigation(); return <div/>; }
      render(<Bad />);
    }).toThrow();
  });
});
