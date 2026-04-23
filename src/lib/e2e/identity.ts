export const E2E_IDENTITY_STORAGE_KEY = 'e2e.identity';

export type E2eIdentity = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

export function isE2eMockEnabled(): boolean {
  const value = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_E2E_MOCKS : undefined;
  if (value) {
    return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
  }
  if (typeof window !== 'undefined') {
    const globalFlag = (window as { __E2E_MOCKS__?: boolean }).__E2E_MOCKS__;
    if (globalFlag) return true;
  }
  return false;
}

export function readE2eIdentity(): E2eIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(E2E_IDENTITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<E2eIdentity> | null;
    if (!parsed || typeof parsed.id !== 'string') return null;
    if (typeof parsed.email !== 'string' || typeof parsed.name !== 'string') return null;
    return {
      id: parsed.id,
      email: parsed.email,
      name: parsed.name,
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : undefined,
    };
  } catch (_error) {
    return null;
  }
}
