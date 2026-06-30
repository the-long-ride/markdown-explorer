import React from 'react';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

interface RenderOptions {
  state?: Record<string, any>;
  dispatch?: ReturnType<typeof vi.fn>;
  bridge?: Record<string, any>;
}

export function createWrapper(options: RenderOptions = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement('div', { 'data-testid': 'test-wrapper' }, children);
  };
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const wrapper = createWrapper(options);
  return render(ui, { wrapper });
}
