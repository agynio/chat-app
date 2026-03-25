import React from 'react';
import type { UserProfile } from 'oidc-client-ts';
import { useAuth } from 'react-oidc-context';
import { http } from '@/api/http';
import { oidcConfig } from '@/config';
import type { User, UserContextType } from './user-types';
import { UserContext } from './user.runtime';

type MeResponse = { identity_id: string; identity_type: string };

const mockUser: User = { name: 'Casey Quinn', email: 'casey@example.com', identityId: 'mock-identity-id' };

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
  const profileUser = buildUserFromProfile(auth.user?.profile);
  const [identityId, setIdentityId] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!auth.user?.access_token) return;
    let isActive = true;
    http.get<MeResponse>('/api/me')
      .then((resp) => {
        if (!isActive) return;
        setIdentityId(resp.identity_id);
      })
      .catch((error) => {
        console.warn('[user] failed to load identity', error);
      });
    return () => {
      isActive = false;
    };
  }, [auth.user?.access_token]);

  const user = React.useMemo<User | null>(() => {
    if (!profileUser) return null;
    return { ...profileUser, identityId };
  }, [profileUser, identityId]);

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
