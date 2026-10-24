import type { UserProfile } from 'oidc-client-ts';
import type { User } from './user-types';

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

// The signed-in user, from the ID token's claims. Only the email is required:
// `name` is optional in OIDC, and a provider that signs users up by email alone
// -- Logto configured for email sign-up is one -- never asserts it. Requiring it
// turned every such account into "Unable to load user profile", while the rest
// of the app already falls back to the email wherever it shows a name.
export function buildUserFromProfile(profile: UserProfile | null | undefined): User | null {
  if (!profile) return null;
  const email = firstNonEmpty(profile.email);
  if (!email) return null;

  const name = firstNonEmpty(profile.name, profile.preferred_username, profile.nickname) || email;
  const avatarUrl = firstNonEmpty(profile.picture) || undefined;
  return { name, email, avatarUrl };
}
