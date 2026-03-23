import type { BrowserContext, Page } from '@playwright/test';
import type { Agent } from '../../src/api/types/agents';

const CHAT_GATEWAY_PATH = '/api/agynio.api.gateway.v1.ChatGateway';
const AGENTS_GATEWAY_PATH = '/api/agynio.api.gateway.v1.AgentsGateway';

const CONNECT_HEADERS = {
  'Content-Type': 'application/json',
  'Connect-Protocol-Version': '1',
};

type ListAgentsResponse = {
  agents?: Agent[];
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
      };
      return {
        profileSub: typeof parsed.profile?.sub === 'string' ? parsed.profile.sub : null,
        profileEmail: typeof parsed.profile?.email === 'string' ? parsed.profile.email : null,
        idToken: typeof parsed.id_token === 'string' ? parsed.id_token : null,
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
  context: BrowserContext,
  servicePath: string,
  method: string,
  payload: unknown,
): Promise<T> {
  const response = await context.request.post(buildRpcUrl(servicePath, method), {
    data: payload,
    headers: CONNECT_HEADERS,
  });
  if (!response.ok()) {
    throw new Error(`ConnectRPC ${method} failed with status ${response.status()}.`);
  }
  return (await response.json()) as T;
}

export type AgentOption = { id: string; name: string };

export async function listAgents(context: BrowserContext): Promise<AgentOption[]> {
  const response = await postConnect<ListAgentsResponse>(context, AGENTS_GATEWAY_PATH, 'ListAgents', {});
  if (!Array.isArray(response.agents)) {
    throw new Error('Invalid agents response');
  }
  return response.agents.map((agent) => {
    if (!agent.meta?.id || typeof agent.meta.id !== 'string') {
      throw new Error(`Invalid agent payload: ${JSON.stringify(agent)}`);
    }
    if (!agent.name || typeof agent.name !== 'string') {
      throw new Error(`Invalid agent payload: ${JSON.stringify(agent)}`);
    }
    return { id: agent.meta.id, name: agent.name };
  });
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

export async function createChat(context: BrowserContext, participantId?: string): Promise<string> {
  const participantIds = participantId ? [participantId] : [];
  const response = await postConnect<CreateChatResponseWire>(context, CHAT_GATEWAY_PATH, 'CreateChat', {
    participantIds,
  });
  if (!response.chat?.id) {
    throw new Error('CreateChat response missing chat id.');
  }
  return response.chat.id;
}

export async function sendChatMessage(
  context: BrowserContext,
  chatId: string,
  message: string,
): Promise<void> {
  await postConnect(context, CHAT_GATEWAY_PATH, 'SendMessage', {
    chatId,
    body: message,
  });
}
