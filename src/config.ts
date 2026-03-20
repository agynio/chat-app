// Centralized environment configuration for the chat app.
// Reads runtime-injected config first, then Vite env for local development.

type RuntimeConfig = {
  API_BASE_URL?: string;
  OIDC_AUTHORITY?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_REDIRECT_URI?: string;
  OIDC_POST_LOGOUT_REDIRECT_URI?: string;
  OIDC_SCOPE?: string;
};

type ViteEnv = {
  VITE_API_BASE_URL?: string;
  VITE_OIDC_AUTHORITY?: string;
  VITE_OIDC_CLIENT_ID?: string;
  VITE_OIDC_REDIRECT_URI?: string;
  VITE_OIDC_POST_LOGOUT_REDIRECT_URI?: string;
  VITE_OIDC_SCOPE?: string;
};

type OidcConfigEnabled = {
  enabled: true;
  authority: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
};

type OidcConfigDisabled = {
  enabled: false;
};

type OidcConfig = OidcConfigEnabled | OidcConfigDisabled;

const runtimeConfig: RuntimeConfig = typeof window !== 'undefined' ? (window.__APP_CONFIG ?? {}) : {};

function readConfigValue(runtimeKey: keyof RuntimeConfig, envKey: keyof ViteEnv): string | null {
  const runtimeValue = runtimeConfig[runtimeKey];
  if (typeof runtimeValue === 'string' && runtimeValue.trim()) return runtimeValue.trim();

  const envValue = import.meta.env?.[envKey];
  if (typeof envValue === 'string' && envValue.trim()) return envValue.trim();

  return null;
}

function requireConfig(name: string, value: string | null): string {
  if (value !== null) return value;
  throw new Error(`chat-app config: required ${name} is missing`);
}

function stripTrailingSlash(pathname: string): string {
  if (pathname === '/') return '';
  return pathname.replace(/\/+$/, '');
}

function stripTrailingApi(pathname: string): string {
  return pathname.replace(/\/api\/?$/, '/');
}

function resolveUrl(raw: string): URL {
  const trimmed = raw.trim();
  try {
    return new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  } catch (_err) {
    return new URL(trimmed, 'http://localhost');
  }
}

function deriveBase(raw: string, options: { stripApi: boolean }): string {
  const parsed = resolveUrl(raw);
  if (options.stripApi) parsed.pathname = stripTrailingApi(parsed.pathname);
  const cleanedPath = stripTrailingSlash(parsed.pathname);
  return cleanedPath ? `${parsed.origin}${cleanedPath}` : parsed.origin;
}

const rawApiBase = requireConfig('API_BASE_URL', readConfigValue('API_BASE_URL', 'VITE_API_BASE_URL'));
const apiBaseUrl = deriveBase(rawApiBase, { stripApi: true });
const socketBaseUrl = deriveBase(rawApiBase, { stripApi: true });

const rawOidcAuthority = readConfigValue('OIDC_AUTHORITY', 'VITE_OIDC_AUTHORITY');
const oidcEnabled = Boolean(rawOidcAuthority);

export const oidcConfig: OidcConfig = oidcEnabled
  ? {
      enabled: true,
      authority: requireConfig('OIDC_AUTHORITY', rawOidcAuthority),
      clientId: requireConfig('OIDC_CLIENT_ID', readConfigValue('OIDC_CLIENT_ID', 'VITE_OIDC_CLIENT_ID')),
      redirectUri: requireConfig('OIDC_REDIRECT_URI', readConfigValue('OIDC_REDIRECT_URI', 'VITE_OIDC_REDIRECT_URI')),
      postLogoutRedirectUri: requireConfig(
        'OIDC_POST_LOGOUT_REDIRECT_URI',
        readConfigValue('OIDC_POST_LOGOUT_REDIRECT_URI', 'VITE_OIDC_POST_LOGOUT_REDIRECT_URI'),
      ),
      scope: requireConfig('OIDC_SCOPE', readConfigValue('OIDC_SCOPE', 'VITE_OIDC_SCOPE')),
    }
  : { enabled: false };

export const config = {
  apiBaseUrl,
  socketBaseUrl,
};

export function getSocketBaseUrl(): string {
  return socketBaseUrl;
}
