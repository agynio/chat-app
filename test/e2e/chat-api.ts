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
      const parsed = JSON.parse(raw) as { access_token?: unknown };
      return {
        accessToken: typeof parsed.access_token === 'string' ? parsed.access_token : null,
      };
    } catch (_error) {
      return null;
    }
  });
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

export async function resolveIdentityId(page: Page): Promise<string> {
  const session = await readOidcSession(page);
  const token = session?.accessToken ?? null;
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const baseUrl = resolveBaseUrl();
  const response = await page.context().request.get(`${baseUrl}/api/me`, { headers });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`GET /api/me failed with status ${response.status()}: ${body}`);
  }

  const payload = (await response.json()) as { identity_id?: string };
  if (!payload.identity_id) {
    throw new Error('/api/me response missing identity_id');
  }
  return payload.identity_id;
}

export async function createChat(page: Page, participantId?: string): Promise<string> {
  const actualParticipantId = participantId ?? await resolveIdentityId(page);
  const participantIds = [actualParticipantId];
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
