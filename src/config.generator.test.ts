import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The image writes window.__APP_CONFIG from its environment at startup
// (docker/40-generate-config.sh). A key config.ts reads but the generator never
// writes is silently absent in every deployed image, whatever the chart sets:
// OIDC_RESOURCE went missing that way, so sign-in never requested the API
// resource, the provider issued an opaque token, and the gateway rejected every
// call.
describe('runtime config generator', () => {
  const root = resolve(__dirname, '..');
  const configSource = readFileSync(resolve(root, 'src/config.ts'), 'utf8');
  const generator = readFileSync(resolve(root, 'docker/40-generate-config.sh'), 'utf8');

  const readKeys = [...configSource.matchAll(/readConfigValue\('([A-Z_]+)'/g)].map((match) => match[1]);
  const writtenKeys = new Set([...generator.matchAll(/^\s+([A-Z_]+):\s*"/gm)].map((match) => match[1]));

  it('finds the keys it compares', () => {
    expect(readKeys.length).toBeGreaterThan(0);
    expect(writtenKeys.size).toBeGreaterThan(0);
  });

  it('writes every key config.ts reads at runtime', () => {
    expect(readKeys.filter((key) => !writtenKeys.has(key))).toEqual([]);
  });
});
