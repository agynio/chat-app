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
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('deriveMediaProxyUrl', () => {
  it('derives media proxy for subdomain hosts', () => {
    setLocation('https://chat.agyn.dev');
    expect(deriveMediaProxyUrl()).toBe('https://media.agyn.dev');
  });

  it('preserves ports when deriving', () => {
    setLocation('https://chat.agyn.dev:1111');
    expect(deriveMediaProxyUrl()).toBe('https://media.agyn.dev:1111');
  });

  it('returns null for localhost', () => {
    setLocation('http://localhost');
    expect(deriveMediaProxyUrl()).toBeNull();
  });

  it('returns null for IP addresses', () => {
    setLocation('http://192.168.1.50');
    expect(deriveMediaProxyUrl()).toBeNull();
  });

  it('returns null for bare domains', () => {
    setLocation('https://agyn.dev');
    expect(deriveMediaProxyUrl()).toBeNull();
  });
});
