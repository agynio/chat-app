import React from 'react';
import type { UserContextType } from './user-types';
import { UserContext } from './user.runtime';

const AUTH_STORAGE_KEY = 'chat-app:oidc-authenticated';
const CODE_CHALLENGE = 'mockauth-e2e-code-challenge-00000000000000000000000';

type OidcConfig = {
  authority: string;
  clientId: string;
  redirectUri: string;
  scope: string;
};

function resolveOidcConfig(): OidcConfig | null {
  const authority = import.meta.env.VITE_OIDC_AUTHORITY?.trim();
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID?.trim();
  const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI?.trim();
  const scope = import.meta.env.VITE_OIDC_SCOPE?.trim();
  if (!authority || !clientId || !redirectUri || !scope) return null;

  return {
    authority: authority.replace(/\/+$/, ''),
    clientId,
    redirectUri,
    scope,
  };
}

function buildAuthorizeUrl(config: OidcConfig, origin: string): string {
  const authorizeUrl = new URL(`${config.authority}/authorize`);
  const redirectUri = new URL(config.redirectUri, origin).toString();
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', config.scope);
  authorizeUrl.searchParams.set('code_challenge', CODE_CHALLENGE);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  return authorizeUrl.toString();
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const oidcConfig = React.useMemo(() => resolveOidcConfig(), []);

  React.useEffect(() => {
    if (!oidcConfig || typeof window === 'undefined') return;

    const currentUrl = new URL(window.location.href);
    const callbackUrl = new URL(oidcConfig.redirectUri, currentUrl.origin);
    if (currentUrl.pathname === callbackUrl.pathname) {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      return;
    }

    if (localStorage.getItem(AUTH_STORAGE_KEY) === 'true') {
      return;
    }

    const authorizeUrl = buildAuthorizeUrl(oidcConfig, currentUrl.origin);
    window.location.assign(authorizeUrl);
  }, [oidcConfig]);

  const value: UserContextType = { user: { name: 'Casey Quinn', email: 'casey@example.com' } };
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
