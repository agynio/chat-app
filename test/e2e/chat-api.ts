import type { Page } from '@playwright/test';

const CHAT_GATEWAY_PATH = '/api/agynio.api.gateway.v1.ChatGateway';
const AGENTS_GATEWAY_PATH = '/api/agynio.api.gateway.v1.AgentsGateway';
const ORGS_GATEWAY_PATH = '/api/agynio.api.gateway.v1.OrganizationsGateway';

const CONNECT_HEADERS = {
  'Content-Type': 'application/json',
  'Connect-Protocol-Version': '1',
};

type CreateChatResponseWire = {
  chat?: { id?: string };
};

type CreateOrganizationResponseWire = {
  organization?: { id?: string };
};

type ListAccessibleOrganizationsResponseWire = {
  organizations?: Array<{ id: string; name: string }>;
};

type CreateAgentResponseWire = {
  agent?: { meta?: { id?: string } };
};

type CreateEnvResponseWire = {
  env?: { meta?: { id?: string } };
};

type Message = {
  id?: string;
  senderId?: string;
  body?: string;
};

type GetMessagesResponseWire = {
  messages?: Message[];
};

type ListAgentsResponseWire = {
  agents?: Array<{ meta?: { id?: string }; name?: string }>;
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

export async function createChat(page: Page, participantId: string): Promise<string> {
  const response = await postConnect<CreateChatResponseWire>(page, CHAT_GATEWAY_PATH, 'CreateChat', {
    participantIds: [participantId],
  });
  if (!response.chat?.id) {
    throw new Error('CreateChat response missing chat id.');
  }
  return response.chat.id;
}

export async function createOrganization(page: Page, name: string): Promise<string> {
  const response = await postConnect<CreateOrganizationResponseWire>(
    page,
    ORGS_GATEWAY_PATH,
    'CreateOrganization',
    { name },
  );
  if (!response.organization?.id) {
    throw new Error('CreateOrganization response missing organization id.');
  }
  return response.organization.id;
}

export async function listAccessibleOrganizations(
  page: Page,
): Promise<Array<{ id: string; name: string }>> {
  const response = await postConnect<ListAccessibleOrganizationsResponseWire>(
    page,
    ORGS_GATEWAY_PATH,
    'ListAccessibleOrganizations',
    {},
  );
  return response.organizations ?? [];
}

type CreateAgentOptions = {
  organizationId: string;
  name: string;
  role: string;
  model: string;
  description: string;
  configuration: string;
  image: string;
  initImage?: string;
};

export async function createAgent(page: Page, opts: CreateAgentOptions): Promise<string> {
  const { initImage, ...rest } = opts;
  const payload = initImage ? { ...rest, initImage } : rest;
  const response = await postConnect<CreateAgentResponseWire>(
    page,
    AGENTS_GATEWAY_PATH,
    'CreateAgent',
    payload,
  );
  if (!response.agent?.meta?.id) {
    throw new Error('CreateAgent response missing agent id.');
  }
  return response.agent.meta.id;
}

export async function createAgentEnv(
  page: Page,
  agentId: string,
  name: string,
  value: string,
): Promise<string> {
  const response = await postConnect<CreateEnvResponseWire>(page, AGENTS_GATEWAY_PATH, 'CreateEnv', {
    agentId,
    name,
    value,
    description: `e2e env: ${name}`,
  });
  if (!response.env?.meta?.id) {
    throw new Error(`CreateEnv response missing env id for ${name}.`);
  }
  return response.env.meta.id;
}

export async function listAgents(
  page: Page,
  organizationId: string,
): Promise<Array<{ meta?: { id?: string }; name?: string }>> {
  const response = await postConnect<ListAgentsResponseWire>(page, AGENTS_GATEWAY_PATH, 'ListAgents', {
    organizationId,
  });
  return response.agents ?? [];
}

export async function getMessages(page: Page, chatId: string): Promise<Message[]> {
  const response = await postConnect<GetMessagesResponseWire>(page, CHAT_GATEWAY_PATH, 'GetMessages', {
    chatId,
  });
  return response.messages ?? [];
}

export async function waitForAgentReply(
  page: Page,
  chatId: string,
  senderIdToExclude: string,
  timeoutMs = 120000,
  intervalMs = 3000,
): Promise<Message> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const messages = await getMessages(page, chatId);
    const agentMsg = messages.find(
      (message) => message.senderId && message.senderId !== senderIdToExclude && message.body,
    );
    if (agentMsg) return agentMsg;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Agent did not reply within ${timeoutMs}ms`);
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
