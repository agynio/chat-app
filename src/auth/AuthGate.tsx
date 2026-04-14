import { type ReactNode, useEffect, useRef } from 'react';
import { AuthProvider, useAuth, withAuthenticationRequired } from 'react-oidc-context';
import { Button } from '@/components/Button';
import { oidcConfig } from '@/config';
import { userManager } from './user-manager';

type AuthGateProps = {
  children: ReactNode;
};

function handleSigninCallback() {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  const cleanedUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, document.title, cleanedUrl);
}

const RequireAuth = withAuthenticationRequired(({ children }: { children: ReactNode }) => <>{children}</>);

function AuthErrorScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="rounded-lg border bg-background px-6 py-5 text-center shadow-sm">
        <div className="text-sm font-medium text-foreground">We couldn't sign you in.</div>
        <div className="mt-1 text-xs text-muted-foreground">Try signing in again to continue.</div>
        <Button className="mt-4" size="sm" onClick={onSignIn}>
          Sign in
        </Button>
      </div>
    </div>
  );
}

function AuthErrorBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { error, removeUser, signinRedirect } = auth;
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error) {
      lastErrorRef.current = null;
      return;
    }
    if (error.message === lastErrorRef.current) return;
    lastErrorRef.current = error.message;
    console.warn('OIDC error, redirecting to sign-in', error);
    void removeUser().catch((removeError) => {
      console.warn('Failed to clear OIDC user session.', removeError);
    });
  }, [error, removeUser]);

  if (error) {
    return <AuthErrorScreen onSignIn={() => void signinRedirect()} />;
  }
  return <>{children}</>;
}

export function AuthGate({ children }: AuthGateProps) {
  if (!oidcConfig.enabled) return <>{children}</>;
  if (!userManager) throw new Error('auth: user manager not initialized');

  return (
    <AuthProvider userManager={userManager} onSigninCallback={handleSigninCallback}>
      <AuthErrorBoundary>
        <RequireAuth>{children}</RequireAuth>
      </AuthErrorBoundary>
    </AuthProvider>
  );
}
