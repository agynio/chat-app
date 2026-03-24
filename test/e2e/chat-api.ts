import type { Page } from '@playwright/test';

const CHAT_GATEWAY_PATH = '/api/agynio.api.gateway.v1.ChatGateway';

const CONNECT_HEADERS = {
  'Content-Type': 'application/json',
  'Connect-Protocol-Version': '1',
};

type CreateChatResponseWire = {
  chat?: { id?: string };
};

function resolveBaseUrl(): string {
  const baseUrl = process.env.E2E_BASE_URL;
  if (!baseUrl) {
    throw new Error('E2E_BASE_URL is required to run e2e tests.');
  }
  return baseUrl;
}

function buildRpcUrl(servicePath: string, method: string): string {
  return new URL(`${servicePath}/${method}`, resolveBaseUrl()).toString();
}

type OidcStorageSnapshot = {
  profileSub: string | null;
  profileEmail: string | null;
  idToken: string | null;
  accessToken: string | null;
};

async function readOidcSession(page: Page): Promise<OidcStorageSnapshot | null> {
  return page.evaluate(() => {
    let storageKey: string | null = null;
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('oidc.user:')) {
        storageKey = key;
        break;
      }
    }

    if (!storageKey) return null;
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as {
        profile?: { sub?: unknown; email?: unknown };
        id_token?: unknown;
        access_token?: unknown;
      };
      return {
        profileSub: typeof parsed.profile?.sub === 'string' ? parsed.profile.sub : null,
        profileEmail: typeof parsed.profile?.email === 'string' ? parsed.profile.email : null,
        idToken: typeof parsed.id_token === 'string' ? parsed.id_token : null,
        accessToken: typeof parsed.access_token === 'string' ? parsed.access_token : null,
      };
    } catch (_error) {
      return null;
    }
  });
}

function decodeJwtSubject(token: string): string | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1] ?? '';
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  try {
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as { sub?: unknown };
    return typeof parsed.sub === 'string' ? parsed.sub : null;
  } catch (_error) {
    return null;
  }
}

async function postConnect<T>(
  page: Page,
  servicePath: string,
  method: string,
  payload: unknown,
): Promise<T> {
  const session = await readOidcSession(page);
  const token = session?.accessToken ?? null;
  const headers = token ? { ...CONNECT_HEADERS, Authorization: `Bearer ${token}` } : CONNECT_HEADERS;
  const response = await page.context().request.post(buildRpcUrl(servicePath, method), {
    data: payload,
    headers,
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`ConnectRPC ${method} failed with status ${response.status()}: ${body}`);
  }
  return (await response.json()) as T;
}

export async function resolveUserId(page: Page, fallbackId?: string): Promise<string> {
  const storedUser = await readOidcSession(page);
  if (!storedUser) {
    if (fallbackId) return fallbackId;
    throw new Error('Missing OIDC session storage entry.');
  }

  if (storedUser.profileSub) return storedUser.profileSub;

  const decodedSub = storedUser.idToken ? decodeJwtSubject(storedUser.idToken) : null;
  if (decodedSub) return decodedSub;

  if (storedUser.profileEmail) return storedUser.profileEmail;

  if (fallbackId) return fallbackId;

  throw new Error('Unable to resolve user id from OIDC session.');
}

export async function createChat(page: Page, participantId?: string): Promise<string> {
  const participantIds = participantId ? [participantId] : [];
  const response = await postConnect<CreateChatResponseWire>(page, CHAT_GATEWAY_PATH, 'CreateChat', {
    participantIds,
  });
  if (!response.chat?.id) {
    throw new Error('CreateChat response missing chat id.');
  }
  return response.chat.id;
}

export async function sendChatMessage(
  page: Page,
  chatId: string,
  message: string,
): Promise<void> {
  await postConnect(page, CHAT_GATEWAY_PATH, 'SendMessage', {
    chatId,
    body: message,
  });
}
