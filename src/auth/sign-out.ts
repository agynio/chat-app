import { userManager } from './user-manager';

// Keycloak publishes end_session_endpoint and keeps a browser session that only
// the redirect can end. Dex publishes neither, and signoutRedirect() throws on
// the missing endpoint -- react-oidc-context catches that into auth.error, so a
// sign-out that already succeeded renders the "We couldn't sign you in" screen.
//
// Discovery being unreachable counts as absent: signing out locally is the safe
// answer when the provider cannot be asked.
async function supportsProviderSignOut(): Promise<boolean> {
  if (!userManager) return false;
  try {
    const metadata = await userManager.metadataService.getMetadata();
    return Boolean(metadata.end_session_endpoint);
  } catch (error) {
    console.warn('Could not read OIDC discovery; signing out locally.', error);
    return false;
  }
}

type SignOutAuth = {
  signoutRedirect: () => Promise<void>;
  removeUser: () => Promise<void>;
};

/**
 * Signs out at the provider when it holds a session, and locally when it does
 * not. The local path navigates to the origin -- the same place the provider
 * redirect lands -- so the app reloads without tokens and asks to sign in again.
 */
export async function signOut(auth: SignOutAuth): Promise<void> {
  if (await supportsProviderSignOut()) {
    await auth.signoutRedirect();
    return;
  }
  await auth.removeUser();
  window.location.replace(window.location.origin);
}
