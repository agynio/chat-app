import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

type LocationStub = {
  protocol: string;
  hostname: string;
  port: string;
  origin: string;
};

type WindowStub = {
  location: LocationStub;
  __APP_CONFIG: { API_BASE_URL: string };
};

let deriveMediaProxyUrl: () => string | null;
let deriveTracingAppUrl: () => string | null;

const windowStub: WindowStub = {
  location: buildLocation('https://chat.agyn.dev'),
  __APP_CONFIG: { API_BASE_URL: '/api' },
};

function buildLocation(url: string): LocationStub {
  const parsed = new URL(url);
  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port,
    origin: parsed.origin,
  };
}

function setLocation(url: string): void {
  windowStub.location = buildLocation(url);
}

beforeAll(async () => {
  vi.stubGlobal('window', windowStub as unknown as Window);
  const mod = await import('./config');
  deriveMediaProxyUrl = mod.deriveMediaProxyUrl;
  deriveTracingAppUrl = mod.deriveTracingAppUrl;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const siblingCases = [
  {
    url: 'https://chat.agyn.dev',
    media: 'https://media.agyn.dev',
    tracing: 'https://tracing.agyn.dev',
  },
  {
    url: 'https://chat.agyn.dev:8443',
    media: 'https://media.agyn.dev:8443',
    tracing: 'https://tracing.agyn.dev:8443',
  },
  {
    url: 'https://chat.staging.agyn.dev',
    media: 'https://media.staging.agyn.dev',
    tracing: 'https://tracing.staging.agyn.dev',
  },
  {
    url: 'http://localhost',
    media: null,
    tracing: null,
  },
  {
    url: 'http://192.168.1.50',
    media: null,
    tracing: null,
  },
  {
    url: 'http://[::1]:3000',
    media: null,
    tracing: null,
  },
  {
    url: 'https://agyn.dev',
    media: null,
    tracing: null,
  },
];

describe('deriveMediaProxyUrl', () => {
  it('derives media proxy URLs from subdomains', () => {
    for (const { url, media } of siblingCases) {
      setLocation(url);
      expect(deriveMediaProxyUrl()).toBe(media);
    }
  });
});

describe('deriveTracingAppUrl', () => {
  it('derives tracing app URLs from subdomains', () => {
    for (const { url, tracing } of siblingCases) {
      setLocation(url);
      expect(deriveTracingAppUrl()).toBe(tracing);
    }
  });
});
