import React from 'react';
import type { UserProfile } from 'oidc-client-ts';
import { useAuth } from 'react-oidc-context';
import { oidcConfig } from '@/config';
import type { User, UserContextType } from './user-types';
import { UserContext } from './user.runtime';

const mockUser: User = { name: 'Casey Quinn', email: 'casey@example.com' };

function buildUserFromProfile(profile: UserProfile | null | undefined): User | null {
  if (!profile) return null;
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  const email = typeof profile.email === 'string' ? profile.email.trim() : '';
  if (!name || !email) return null;

  const avatarUrl = typeof profile.picture === 'string' && profile.picture.trim() ? profile.picture : undefined;
  return { name, email, avatarUrl };
}

function OidcUserProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const user = buildUserFromProfile(auth.user?.profile);
  const value = React.useMemo<UserContextType>(() => ({ user }), [user]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  if (!oidcConfig.enabled) {
    const value: UserContextType = { user: mockUser };
    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
  }
  return <OidcUserProvider>{children}</OidcUserProvider>;
}
