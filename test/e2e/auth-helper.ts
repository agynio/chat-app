import { createHash, randomBytes } from 'node:crypto';

type TokenResponse = {
  idToken: string;
  accessToken: string;
  expiresIn: number;
};

type ClientAuthMethod = 'client_secret_basic' | 'client_secret_post';

type OidcTokens = {
  storageKey: string;
  userJson: string;
};

const DEFAULT_AUTHORITY = 'https://mockauth.dev/r/301ebb13-15a8-48f4-baac-e3fa25be29fc/oidc';
const DEFAULT_CLIENT_ID = 'client_MU95KU3gHQf5Ir7p';
const DEFAULT_REDIRECT_URI = 'https://chat.agyn.dev/callback';
const DEFAULT_SCOPE = 'openid profile email';
const DEFAULT_EMAIL = 'e2e-tester@agyn.test';
const DEFAULT_CLIENT_SECRET = 'XPKka2i9uzISrKZ95zxli8sY51BK4eTJ';
const DEFAULT_TOKEN_AUTH_METHOD: ClientAuthMethod = 'client_secret_basic';

function readEnv(key: string, fallback: string): string {
  const value = process.env[key];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function storeCookies(cookieJar: Map<string, string>, headers: Headers): void {
  for (const cookie of headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    if (!pair) continue;
    const [name, ...valueParts] = pair.trim().split('=');
    if (!name || valueParts.length === 0) continue;
    cookieJar.set(name, valueParts.join('='));
  }
}

function buildCookieHeader(cookieJar: Map<string, string>): string | undefined {
  if (cookieJar.size === 0) return undefined;
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function fetchWithCookies(
  url: string,
  cookieJar: Map<string, string>,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const cookieHeader = buildCookieHeader(cookieJar);
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  const response = await fetch(url, {
    ...init,
    headers,
    redirect: init.redirect ?? 'manual',
  });
  storeCookies(cookieJar, response.headers);
  return response;
}

function parseTokenResponse(data: unknown): TokenResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('MockAuth token response is invalid');
  }
  const record = data as Record<string, unknown>;
  const idToken = record.id_token;
  const accessToken = record.access_token;
  const expiresIn = record.expires_in;
  if (typeof idToken !== 'string' || typeof accessToken !== 'string') {
    throw new Error('MockAuth token response missing tokens');
  }
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn)) {
    throw new Error('MockAuth token response missing expires_in');
  }
  return { idToken, accessToken, expiresIn };
}

function decodeIdTokenClaims(idToken: string): Record<string, unknown> {
  const segments = idToken.split('.');
  if (segments.length < 2 || !segments[1]) {
    throw new Error('MockAuth id_token is malformed');
  }
  const payload = base64UrlDecode(segments[1]);
  const parsed = JSON.parse(payload);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('MockAuth id_token payload is invalid');
  }
  return parsed as Record<string, unknown>;
}

async function fetchReturnTo(authorizeUrl: string, cookieJar: Map<string, string>): Promise<string> {
  let currentUrl = authorizeUrl;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetchWithCookies(currentUrl, cookieJar, { redirect: 'manual' });
    const location = response.headers.get('location');
    if (location) {
      const nextUrl = new URL(location, currentUrl).toString();
      const returnTo = new URL(nextUrl).searchParams.get('return_to');
      if (returnTo) {
        return returnTo;
      }
      currentUrl = nextUrl;
      continue;
    }

    const returnTo = new URL(currentUrl).searchParams.get('return_to');
    if (returnTo) {
      return returnTo;
    }
    throw new Error('MockAuth authorize did not redirect to login');
  }
  throw new Error('MockAuth login redirect limit exceeded');
}

async function submitLogin(
  authorityBase: string,
  email: string,
  returnTo: string,
  cookieJar: Map<string, string>,
): Promise<string> {
  const loginUrl = `${authorityBase}/login/submit`;
  const body = new URLSearchParams({
    strategy: 'email',
    email,
    return_to: returnTo,
  });
  const response = await fetchWithCookies(loginUrl, cookieJar, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (response.status >= 400) {
    throw new Error(`MockAuth login failed with status ${response.status}`);
  }
  const location = response.headers.get('location');
  if (!location) {
    throw new Error('MockAuth login response missing redirect');
  }
  return new URL(location, loginUrl).toString();
}

async function fetchAuthorizationCode(
  authorizeUrl: string,
  redirectUri: string,
  expectedState: string,
  cookieJar: Map<string, string>,
): Promise<string> {
  const response = await fetchWithCookies(authorizeUrl, cookieJar, { redirect: 'manual' });
  const location = response.headers.get('location');
  if (!location) {
    throw new Error('MockAuth authorize response missing redirect');
  }
  const callbackUrl = new URL(location, redirectUri);
  const code = callbackUrl.searchParams.get('code');
  const state = callbackUrl.searchParams.get('state');
  if (!code) {
    throw new Error('MockAuth authorize response missing code');
  }
  if (state !== expectedState) {
    throw new Error('MockAuth authorize response state mismatch');
  }
  return code;
}

async function exchangeToken(
  authorityBase: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string,
  code: string,
  clientSecret: string,
  authMethod: ClientAuthMethod,
): Promise<TokenResponse> {
  const tokenUrl = `${authorityBase}/token`;
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  };
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: clientId,
  });

  if (authMethod === 'client_secret_basic') {
    const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.authorization = `Basic ${encoded}`;
  } else if (authMethod === 'client_secret_post') {
    body.set('client_secret', clientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`MockAuth token exchange failed: ${response.status} ${message}`);
  }
  const data = (await response.json()) as unknown;
  return parseTokenResponse(data);
}

export async function acquireOidcTokens(): Promise<OidcTokens> {
  const authority = readEnv('E2E_OIDC_AUTHORITY', DEFAULT_AUTHORITY);
  const authorityBase = authority.replace(/\/+$/g, '');
  const clientId = readEnv('E2E_OIDC_CLIENT_ID', DEFAULT_CLIENT_ID);
  const redirectUri = readEnv('E2E_OIDC_REDIRECT_URI', DEFAULT_REDIRECT_URI);
  const scope = readEnv('E2E_OIDC_SCOPE', DEFAULT_SCOPE);
  const email = readEnv('E2E_OIDC_EMAIL', DEFAULT_EMAIL);
  const clientSecret = readEnv('E2E_OIDC_CLIENT_SECRET', DEFAULT_CLIENT_SECRET);
  const authMethodValue = readEnv('E2E_OIDC_TOKEN_AUTH_METHOD', DEFAULT_TOKEN_AUTH_METHOD);
  if (!['client_secret_basic', 'client_secret_post'].includes(authMethodValue)) {
    throw new Error(`Unsupported E2E_OIDC_TOKEN_AUTH_METHOD: ${authMethodValue}`);
  }
  const tokenAuthMethod = authMethodValue as ClientAuthMethod;

  const state = base64UrlEncode(randomBytes(16));
  const nonce = base64UrlEncode(randomBytes(16));
  const codeVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = base64UrlEncode(createHash('sha256').update(codeVerifier).digest());

  const authorizeUrl = new URL(`${authorityBase}/authorize`);
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString();

  const cookieJar = new Map<string, string>();
  const returnTo = await fetchReturnTo(authorizeUrl.toString(), cookieJar);
  const authorizeRedirect = await submitLogin(authorityBase, email, returnTo, cookieJar);
  const code = await fetchAuthorizationCode(authorizeRedirect, redirectUri, state, cookieJar);
  const tokenResponse = await exchangeToken(
    authorityBase,
    clientId,
    redirectUri,
    codeVerifier,
    code,
    clientSecret,
    tokenAuthMethod,
  );
  const profile = decodeIdTokenClaims(tokenResponse.idToken);

  const user = {
    id_token: tokenResponse.idToken,
    session_state: null,
    access_token: tokenResponse.accessToken,
    token_type: 'Bearer',
    scope,
    profile,
    expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expiresIn,
  };

  return {
    storageKey: `oidc.user:${authority}:${clientId}`,
    userJson: JSON.stringify(user),
  };
}
