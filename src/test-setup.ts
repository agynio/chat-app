import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Without vitest globals, testing-library never auto-unmounts between tests.
afterEach(cleanup);

// jsdom has neither; the composer measures itself and ThemeProvider reads the
// colour-scheme query, both on mount.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}


if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
