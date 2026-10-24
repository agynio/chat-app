import { describe, expect, it } from 'vitest';
import type { UserProfile } from 'oidc-client-ts';
import { buildUserFromProfile } from './profile';

const profile = (claims: Record<string, unknown>) => ({ sub: 'subject', ...claims }) as unknown as UserProfile;

describe('buildUserFromProfile', () => {
  it('accepts an account that has an email but no name', () => {
    expect(buildUserFromProfile(profile({ email: 'vitalii@agyn.io' }))).toEqual({
      name: 'vitalii@agyn.io',
      email: 'vitalii@agyn.io',
      avatarUrl: undefined,
    });
  });

  it('prefers the name, then the username, then the nickname', () => {
    expect(buildUserFromProfile(profile({ email: 'a@b.c', name: ' Ada ', preferred_username: 'ada' }))?.name).toBe('Ada');
    expect(buildUserFromProfile(profile({ email: 'a@b.c', name: '  ', preferred_username: 'ada' }))?.name).toBe('ada');
    expect(buildUserFromProfile(profile({ email: 'a@b.c', nickname: 'Ace' }))?.name).toBe('Ace');
  });

  it('still requires an email', () => {
    expect(buildUserFromProfile(profile({ name: 'Ada' }))).toBeNull();
    expect(buildUserFromProfile(profile({ email: '   ' }))).toBeNull();
    expect(buildUserFromProfile(null)).toBeNull();
  });

  it('keeps a picture only when one is set', () => {
    expect(buildUserFromProfile(profile({ email: 'a@b.c', picture: 'https://x/y.png' }))?.avatarUrl).toBe('https://x/y.png');
    expect(buildUserFromProfile(profile({ email: 'a@b.c', picture: '' }))?.avatarUrl).toBeUndefined();
  });
});
