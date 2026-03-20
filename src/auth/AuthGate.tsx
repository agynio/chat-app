import type { ReactNode } from 'react';
import { AuthProvider, withAuthenticationRequired } from 'react-oidc-context';
import { oidcConfig } from '@/config';
import { userManager } from './user-manager';

type AuthGateProps = {
  children: ReactNode;
};

function handleSigninCallback() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  const cleanedUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, document.title, cleanedUrl);
}

const RequireAuth = withAuthenticationRequired(({ children }: { children: ReactNode }) => <>{children}</>);

export function AuthGate({ children }: AuthGateProps) {
  if (!oidcConfig.enabled) return <>{children}</>;
  if (!userManager) throw new Error('auth: user manager not initialized');

  return (
    <AuthProvider userManager={userManager} onSigninCallback={handleSigninCallback}>
      <RequireAuth>{children}</RequireAuth>
    </AuthProvider>
  );
}
