import * as crypto from 'node:crypto';
import type { BrowserContext, Request } from '@playwright/test';

type MockIdentity = {
  id: string;
  email?: string;
  name?: string;
};

type MockUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type MockOrganization = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type MockMembership = {
  id: string;
  organizationId: string;
  identityId: string;
  role: string;
  status: 'accepted' | 'pending';
};

type MockAgent = {
  meta: { id: string; createdAt: string; updatedAt: string };
  organizationId: string;
  name: string;
  role: string;
  model: string;
  description: string;
  configuration: Record<string, unknown>;
  image: string;
  resources?: Record<string, unknown>;
};

type MockChat = {
  id: string;
  organizationId: string;
  participants: Array<{ id: string; joinedAt: string }>;
  createdAt: string;
  updatedAt: string;
  status: 'open' | 'closed';
  summary: string | null;
};

type MockMessage = {
  id: string;
  chatId: string;
  senderId: string;
  body: string;
  fileIds: string[];
  createdAt: string;
};

type MockResponse = {
  status: number;
  body: Uint8Array;
  contentType: string;
};

const CHAT_GATEWAY_PATH = '/api/agynio.api.gateway.v1.ChatGateway';
const AGENTS_GATEWAY_PATH = '/api/agynio.api.gateway.v1.AgentsGateway';
const LLM_GATEWAY_PATH = '/api/agynio.api.gateway.v1.LLMGateway';
const ORGS_GATEWAY_PATH = '/api/agynio.api.gateway.v1.OrganizationsGateway';
const USERS_GATEWAY_PATH = '/api/agynio.api.gateway.v1.UsersGateway';
const NOTIFICATIONS_GATEWAY_PATH = '/api/agynio.api.gateway.v1.NotificationsGateway';

const HEADER_IDENTITY_ID = 'x-e2e-identity-id';
const HEADER_IDENTITY_EMAIL = 'x-e2e-user-email';
const HEADER_IDENTITY_NAME = 'x-e2e-user-name';

const AUTO_REPLY_TRIGGER = 'hello';
const AUTO_REPLY_MESSAGE = 'How are you doing today?';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  return crypto.randomUUID();
}

function parseConfiguration(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown> | null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
      return {};
    }
  }
  return typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function resolveServicePath(pathname: string): { servicePath: string; method: string } | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const method = parts[parts.length - 1];
  const servicePath = `/${parts.slice(0, -1).join('/')}`;
  return { servicePath, method };
}

function parsePayload(request: Request): unknown {
  const raw = request.postData();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch (_error) {
    return {};
  }
}

class MockBackend {
  private users = new Map<string, MockUser>();
  private organizations = new Map<string, MockOrganization>();
  private memberships = new Map<string, MockMembership>();
  private agents = new Map<string, MockAgent>();
  private chats = new Map<string, MockChat>();
  private messages = new Map<string, MockMessage[]>();

  reset(): void {
    this.users.clear();
    this.organizations.clear();
    this.memberships.clear();
    this.agents.clear();
    this.chats.clear();
    this.messages.clear();
  }

  handleHttpRequest(request: Request): MockResponse | null {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return null;
    const identity = this.resolveIdentity(request.headers());

    if (request.method() === 'GET' && url.pathname === '/api/me') {
      if (!identity) {
        return this.jsonResponse(401, { error: 'Missing identity' });
      }
      return this.jsonResponse(200, { identity_id: identity.id, identity_type: 'mock' });
    }

    if (request.method() !== 'POST') {
      return this.jsonResponse(405, { error: 'Method not allowed' });
    }

    const parsed = resolveServicePath(url.pathname);
    if (!parsed) {
      return this.jsonResponse(404, { error: 'Unknown endpoint' });
    }

    if (parsed.servicePath === NOTIFICATIONS_GATEWAY_PATH && parsed.method === 'Subscribe') {
      return {
        status: 200,
        body: new Uint8Array([0x02, 0x00, 0x00, 0x00, 0x00]),
        contentType: 'application/connect+json',
      };
    }
    const payload = parsePayload(request);
    try {
      const body = this.handleConnect(parsed.servicePath, parsed.method, payload, identity);
      return this.jsonResponse(200, body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mock backend error';
      return this.jsonResponse(500, { error: message });
    }
  }

  handleConnect(
    servicePath: string,
    method: string,
    payload: unknown,
    identity: MockIdentity | null,
  ): unknown {
    switch (servicePath) {
      case CHAT_GATEWAY_PATH:
        return this.handleChat(method, payload, identity);
      case AGENTS_GATEWAY_PATH:
        return this.handleAgents(method, payload);
      case LLM_GATEWAY_PATH:
        return this.handleLlm(method);
      case ORGS_GATEWAY_PATH:
        return this.handleOrganizations(method, payload, identity);
      case USERS_GATEWAY_PATH:
        return this.handleUsers(method, payload, identity);
      default:
        throw new Error(`Unhandled service ${servicePath}`);
    }
  }

  private resolveIdentity(headers: Record<string, string>): MockIdentity | null {
    const identityId = headers[HEADER_IDENTITY_ID];
    if (!identityId) return null;
    const email = headers[HEADER_IDENTITY_EMAIL];
    const name = headers[HEADER_IDENTITY_NAME];
    const identity: MockIdentity = {
      id: identityId,
      email: email || undefined,
      name: name || undefined,
    };
    this.ensureUser(identity);
    return identity;
  }

  private jsonResponse(status: number, payload: unknown): MockResponse {
    return {
      status,
      body: new TextEncoder().encode(JSON.stringify(payload)),
      contentType: 'application/json',
    };
  }

  private ensureUser(identity: MockIdentity): MockUser {
    const existing = this.users.get(identity.id);
    if (existing) return existing;
    const createdAt = nowIso();
    const fallbackLabel = `User ${identity.id.slice(0, 8)}`;
    const user: MockUser = {
      id: identity.id,
      name: identity.name?.trim() || fallbackLabel,
      email: identity.email?.trim() || `${identity.id.slice(0, 8)}@mock.local`,
      createdAt,
      updatedAt: createdAt,
    };
    this.users.set(user.id, user);
    return user;
  }

  private handleOrganizations(
    method: string,
    payload: unknown,
    identity: MockIdentity | null,
  ): unknown {
    if (method === 'CreateOrganization') {
      const name = (payload as { name?: string }).name?.trim() ?? '';
      if (!name) throw new Error('Organization name is required');
      const createdAt = nowIso();
      const organization: MockOrganization = {
        id: createId(),
        name,
        createdAt,
        updatedAt: createdAt,
      };
      this.organizations.set(organization.id, organization);

      if (identity) {
        const membership: MockMembership = {
          id: createId(),
          organizationId: organization.id,
          identityId: identity.id,
          role: 'MEMBERSHIP_ROLE_OWNER',
          status: 'accepted',
        };
        this.memberships.set(membership.id, membership);
      }

      return { organization };
    }

    if (method === 'CreateMembership') {
      const { organizationId, identityId, role } = payload as {
        organizationId?: string;
        identityId?: string;
        role?: string;
      };
      if (!organizationId || !identityId) throw new Error('Membership requires organizationId and identityId');
      if (!this.organizations.has(organizationId)) throw new Error('Organization not found');
      this.ensureUser({ id: identityId });
      const membership: MockMembership = {
        id: createId(),
        organizationId,
        identityId,
        role: role || 'MEMBERSHIP_ROLE_MEMBER',
        status: 'pending',
      };
      this.memberships.set(membership.id, membership);
      return { membership };
    }

    if (method === 'AcceptMembership') {
      const membershipId = (payload as { membershipId?: string }).membershipId;
      if (!membershipId) throw new Error('membershipId is required');
      const membership = this.memberships.get(membershipId);
      if (!membership) throw new Error('Membership not found');
      membership.status = 'accepted';
      return {};
    }

    if (method === 'ListAccessibleOrganizations') {
      if (!identity) {
        return { organizations: [...this.organizations.values()] };
      }
      const memberships = [...this.memberships.values()].filter(
        (membership) => membership.identityId === identity.id && membership.status === 'accepted',
      );
      const organizations = memberships
        .map((membership) => this.organizations.get(membership.organizationId))
        .filter((org): org is MockOrganization => Boolean(org));
      return { organizations };
    }

    throw new Error(`Unhandled OrganizationsGateway method ${method}`);
  }

  private handleUsers(method: string, payload: unknown, identity: MockIdentity | null): unknown {
    if (method !== 'BatchGetUsers') {
      throw new Error(`Unhandled UsersGateway method ${method}`);
    }
    if (identity) {
      this.ensureUser(identity);
    }
    const ids = (payload as { identityIds?: string[] }).identityIds ?? [];
    const users = ids.map((id) => this.ensureUser({ id }));
    return {
      users: users.map((user) => ({
        meta: { id: user.id, createdAt: user.createdAt, updatedAt: user.updatedAt },
        name: user.name,
        email: user.email,
      })),
    };
  }

  private handleAgents(method: string, payload: unknown): unknown {
    if (method === 'CreateAgent') {
      const data = payload as {
        organizationId?: string;
        name?: string;
        role?: string;
        model?: string;
        description?: string;
        configuration?: unknown;
        image?: string;
      };
      if (!data.organizationId || !data.name || !data.role || !data.model || !data.description || !data.image) {
        throw new Error('CreateAgent payload missing fields');
      }
      const createdAt = nowIso();
      const agent: MockAgent = {
        meta: { id: createId(), createdAt, updatedAt: createdAt },
        organizationId: data.organizationId,
        name: data.name,
        role: data.role,
        model: data.model,
        description: data.description,
        configuration: parseConfiguration(data.configuration),
        image: data.image,
      };
      this.agents.set(agent.meta.id, agent);
      return { agent };
    }

    if (method === 'ListAgents') {
      const { organizationId, pageSize, pageToken } = payload as {
        organizationId?: string;
        pageSize?: number;
        pageToken?: string;
      };
      if (!organizationId) {
        return { agents: [], nextPageToken: undefined };
      }
      const allAgents = [...this.agents.values()].filter((agent) => agent.organizationId === organizationId);
      const start = pageToken ? Number.parseInt(pageToken, 10) || 0 : 0;
      const size = pageSize && pageSize > 0 ? pageSize : allAgents.length;
      const slice = allAgents.slice(start, start + size);
      const next = start + size < allAgents.length ? String(start + size) : undefined;
      return { agents: slice, nextPageToken: next };
    }

    if (method === 'CreateEnv') {
      const createdAt = nowIso();
      return { env: { meta: { id: createId(), createdAt, updatedAt: createdAt } } };
    }

    throw new Error(`Unhandled AgentsGateway method ${method}`);
  }

  private handleLlm(method: string): unknown {
    if (method === 'CreateLLMProvider') {
      const createdAt = nowIso();
      return { provider: { meta: { id: createId(), createdAt, updatedAt: createdAt } } };
    }
    if (method === 'CreateModel') {
      const createdAt = nowIso();
      return { model: { meta: { id: createId(), createdAt, updatedAt: createdAt } } };
    }
    throw new Error(`Unhandled LLMGateway method ${method}`);
  }

  private handleChat(method: string, payload: unknown, identity: MockIdentity | null): unknown {
    if (method === 'CreateChat') {
      const { organizationId, participantIds } = payload as {
        organizationId?: string;
        participantIds?: string[];
      };
      if (!organizationId || !participantIds) {
        throw new Error('CreateChat requires organizationId and participantIds');
      }
      const createdAt = nowIso();
      const participantSet = new Set<string>(participantIds);
      if (identity?.id) {
        participantSet.add(identity.id);
      }
      const participants = [...participantSet].map((id) => ({ id, joinedAt: createdAt }));
      const chat: MockChat = {
        id: createId(),
        organizationId,
        participants,
        createdAt,
        updatedAt: createdAt,
        status: 'open',
        summary: null,
      };
      this.chats.set(chat.id, chat);
      this.messages.set(chat.id, []);
      return { chat };
    }

    if (method === 'GetChats') {
      const { organizationId, pageSize, pageToken } = payload as {
        organizationId?: string;
        pageSize?: number;
        pageToken?: string;
      };
      if (!organizationId) {
        return { chats: [], nextPageToken: undefined };
      }
      const allChats = [...this.chats.values()]
        .filter((chat) => chat.organizationId === organizationId)
        .filter((chat) => {
          if (!identity?.id) return true;
          return chat.participants.some((participant) => participant.id === identity.id);
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      const start = pageToken ? Number.parseInt(pageToken, 10) || 0 : 0;
      const size = pageSize && pageSize > 0 ? pageSize : allChats.length;
      const slice = allChats.slice(start, start + size);
      const next = start + size < allChats.length ? String(start + size) : undefined;
      return { chats: slice, nextPageToken: next };
    }

    if (method === 'GetMessages') {
      const { chatId, pageSize, pageToken } = payload as {
        chatId?: string;
        pageSize?: number;
        pageToken?: string;
      };
      if (!chatId) throw new Error('chatId is required');
      const allMessages = this.messages.get(chatId) ?? [];
      const start = pageToken ? Number.parseInt(pageToken, 10) || 0 : 0;
      const size = pageSize && pageSize > 0 ? pageSize : allMessages.length;
      const slice = allMessages.slice(start, start + size);
      const next = start + size < allMessages.length ? String(start + size) : undefined;
      return { messages: slice, nextPageToken: next, unreadCount: 0 };
    }

    if (method === 'SendMessage') {
      const { chatId, body, fileIds } = payload as {
        chatId?: string;
        body?: string;
        fileIds?: string[];
      };
      if (!chatId || typeof body !== 'string') throw new Error('SendMessage requires chatId and body');
      const chat = this.chats.get(chatId);
      if (!chat) throw new Error('Chat not found');
      const createdAt = nowIso();
      const message: MockMessage = {
        id: createId(),
        chatId,
        senderId: identity?.id ?? 'mock-sender',
        body,
        fileIds: fileIds ?? [],
        createdAt,
      };
      const messages = this.messages.get(chatId) ?? [];
      messages.push(message);
      this.messages.set(chatId, messages);
      chat.updatedAt = createdAt;
      chat.summary = body.slice(0, 140);

      if (body.trim().toLowerCase() === AUTO_REPLY_TRIGGER) {
        const agentId = chat.participants.find((participant) => this.agents.has(participant.id))?.id;
        if (agentId) {
          const reply: MockMessage = {
            id: createId(),
            chatId,
            senderId: agentId,
            body: AUTO_REPLY_MESSAGE,
            fileIds: [],
            createdAt: nowIso(),
          };
          messages.push(reply);
          this.messages.set(chatId, messages);
          chat.updatedAt = reply.createdAt;
        }
      }

      return { message };
    }

    if (method === 'UpdateChat') {
      const { chatId, status, summary } = payload as {
        chatId?: string;
        status?: 'CHAT_STATUS_OPEN' | 'CHAT_STATUS_CLOSED' | 'open' | 'closed';
        summary?: string;
      };
      if (!chatId) throw new Error('chatId is required');
      const chat = this.chats.get(chatId);
      if (!chat) throw new Error('Chat not found');
      if (status) {
        chat.status = status === 'CHAT_STATUS_CLOSED' || status === 'closed' ? 'closed' : 'open';
      }
      if (typeof summary === 'string') {
        chat.summary = summary.trim() ? summary : null;
      }
      chat.updatedAt = nowIso();
      return { chat };
    }

    if (method === 'MarkAsRead') {
      const { messageIds } = payload as { messageIds?: string[] };
      return { readCount: messageIds?.length ?? 0 };
    }

    throw new Error(`Unhandled ChatGateway method ${method}`);
  }
}

const backend = new MockBackend();

export function getMockBackend(): MockBackend {
  return backend;
}

export function resetMockBackend(): void {
  backend.reset();
}

export async function attachMockBackend(context: BrowserContext): Promise<void> {
  await context.route('**/api/**', async (route) => {
    const handled = backend.handleHttpRequest(route.request());
    if (!handled) {
      await route.continue();
      return;
    }
    console.log('[mock-backend] handled', route.request().url());
    await route.fulfill({
      status: handled.status,
      body: Buffer.from(handled.body),
      contentType: handled.contentType,
    });
  });
}
