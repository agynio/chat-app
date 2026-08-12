import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMetadata = vi.fn();
const replace = vi.fn();

vi.mock('./user-manager', () => ({
  userManager: { metadataService: { getMetadata } },
}));

vi.stubGlobal('window', { location: { origin: 'https://chat.agyn.dev:2496', replace } });

const { signOut } = await import('./sign-out');

function buildAuth() {
  return { signoutRedirect: vi.fn().mockResolvedValue(undefined), removeUser: vi.fn().mockResolvedValue(undefined) };
}

describe('signOut', () => {
  beforeEach(() => {
    getMetadata.mockReset();
    replace.mockReset();
  });

  it('redirects to the provider when it publishes an end session endpoint', async () => {
    getMetadata.mockResolvedValue({ end_session_endpoint: 'https://auth.agyn.dev:2496/logout' });
    const auth = buildAuth();

    await signOut(auth);

    expect(auth.signoutRedirect).toHaveBeenCalledOnce();
    expect(auth.removeUser).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  // Dex publishes none and holds no browser session, so dropping the tokens is
  // the whole sign-out. Redirecting anyway throws, and the app renders that as a
  // sign-in failure.
  it('signs out locally when the provider publishes no end session endpoint', async () => {
    getMetadata.mockResolvedValue({ issuer: 'https://dex.agyn.dev:2496' });
    const auth = buildAuth();

    await signOut(auth);

    expect(auth.removeUser).toHaveBeenCalledOnce();
    expect(auth.signoutRedirect).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('https://chat.agyn.dev:2496');
  });

  it('signs out locally when discovery cannot be read', async () => {
    getMetadata.mockRejectedValue(new Error('network down'));
    const auth = buildAuth();

    await signOut(auth);

    expect(auth.removeUser).toHaveBeenCalledOnce();
    expect(auth.signoutRedirect).not.toHaveBeenCalled();
  });
});
