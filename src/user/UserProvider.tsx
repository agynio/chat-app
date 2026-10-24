import React from 'react';
import { useAuth } from 'react-oidc-context';
import { useQuery } from '@tanstack/react-query';
import { http } from '@/api/http';
import { oidcConfig } from '@/config';
import type { User, UserContextType } from './user-types';
import { UserContext } from './user.runtime';
import { buildUserFromProfile } from './profile';

type MeResponse = { identity_id: string; identity_type: string };

const mockUser: User = { name: 'Casey Quinn', email: 'casey@example.com', identityId: 'mock-identity-id' };

function OidcUserProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const profileUser = buildUserFromProfile(auth.user?.profile);
  const accessToken = auth.user?.access_token;
  const subject = auth.user?.profile?.sub;

  const identityQuery = useQuery<MeResponse, Error>({
    // Keyed on who is signed in, not on the token. The HTTP client attaches the
    // current token to every request and renews it on a 401, so a renewal that
    // rotates the token must not start a fresh query: when the gateway rejects
    // tokens for any reason other than expiry, that turned each rejection into a
    // renewal, each renewal into a new query and a new rejection -- an unbounded
    // loop of ~10 token exchanges a second against the provider.
    queryKey: ['user', 'me', subject],
    queryFn: () => http.get<MeResponse>('/api/me'),
    enabled: Boolean(accessToken && subject),
    // The client has already renewed once before a 401 reaches here; repeating
    // the request cannot fix a token the gateway does not accept.
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const identityId = identityQuery.data?.identity_id;

  const identityStatus: UserContextType['identityStatus'] = !accessToken
    ? 'idle'
    : identityQuery.isPending
      ? 'loading'
      : identityQuery.isError
        ? 'error'
        : 'success';

  const identityError = identityQuery.error ?? null;

  const user = React.useMemo<User | null>(() => {
    if (!profileUser) return null;
    return { ...profileUser, identityId };
  }, [profileUser, identityId]);

  const value = React.useMemo<UserContextType>(
    () => ({ user, identityStatus, identityError }),
    [user, identityStatus, identityError],
  );
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  if (!oidcConfig.enabled) {
    const value: UserContextType = { user: mockUser, identityStatus: 'success', identityError: null };
    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
  }
  return <OidcUserProvider>{children}</OidcUserProvider>;
}
