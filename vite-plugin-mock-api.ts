import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin } from 'vite';
import type { Agent } from './src/api/types/agents';
import type { Chat, ChatMessage } from './src/api/types/chat';
import type { FileRecord } from './src/api/types/files';
import type { TemplateSchema } from './src/api/types/graph';
import type { Organization } from './src/api/types/organizations';
import type { UserInfo } from './src/api/types/users';
import type { PersistedGraph } from './src/types/graph';
import { agents as mockAgents } from './src/api/mock-data/agents';
import {
  createChatMessagesMap,
  createUnreadIdsByChatMap,
} from './src/api/mock-data/chat-messages';
import { chatSeeds } from './src/api/mock-data/chats';
import { graph as mockGraph } from './src/api/mock-data/graph';
import { templates as mockTemplates } from './src/api/mock-data/templates';
import { mockUsers } from './src/api/mock-data/users';

const [casey] = mockUsers;
const agentStore = [...mockAgents];
const organizationTimestamp = new Date().toISOString();
const organizations: Organization[] = [
  {
    id: randomUUID(),
    name: 'Default Organization',
    createdAt: organizationTimestamp,
    updatedAt: organizationTimestamp,
  },
];

const chatStore = new Map<string, Chat>(
  chatSeeds.map((seed) => [
    seed.id,
    {
      id: seed.id,
      participants: seed.participants.map((participant) => ({ ...participant })),
      createdAt: seed.createdAt,
      updatedAt: seed.updatedAt,
    },
  ]),
);

const messagesByChat = createChatMessagesMap();
const unreadIdsByChat = createUnreadIdsByChatMap();

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function clampPageSize(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value);
  if (normalized <= 0) return fallback;
  return Math.min(100, normalized);
}

function parsePageToken(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function buildChatResponse(chat: Chat): Chat {
  return {
    ...chat,
    participants: chat.participants.map((participant) => ({ ...participant })),
  };
}

function cloneChatMessage(message: ChatMessage): ChatMessage {
  return { ...message, fileIds: [...message.fileIds] };
}

const agentMetaTimestamp = new Date().toISOString();

function mapAgentToAgent(agent: (typeof mockAgents)[number]): Agent {
  return {
    meta: { id: agent.id, createdAt: agentMetaTimestamp, updatedAt: agentMetaTimestamp },
    name: agent.name,
    role: agent.role,
    model: 'gpt-4.1-mini',
    description: '',
    configuration: {},
    image: '',
  };
}

function buildAgentsResponse(agents: Array<(typeof mockAgents)[number]>, offset: number, pageSize: number) {
  const pageAgents = agents.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  const response: { agents: Agent[]; nextPageToken?: string } = {
    agents: pageAgents.map(mapAgentToAgent),
  };
  if (nextOffset < agents.length) response.nextPageToken = String(nextOffset);
  return response;
}

export function mockApiPlugin(): Plugin {
  return {
    name: 'mock-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, 'http://localhost');
        const { pathname } = url;
        const method = req.method ?? 'GET';

        if (method === 'GET' && pathname === '/api/me') {
          return sendJson(res, 200, { identity_id: casey.id, identity_type: 'user' });
        }

        const chatPrefix = '/api/agynio.api.gateway.v1.ChatGateway/';
        if (pathname.startsWith(chatPrefix)) {
          if (method !== 'POST') {
            return sendJson(res, 405, { code: 'invalid_argument', message: 'Method not allowed' });
          }

          let payload: unknown;
          try {
            payload = await readBody(req);
          } catch (_error) {
            return sendJson(res, 400, { code: 'invalid_argument', message: 'Invalid JSON payload' });
          }

          const rpc = pathname.slice(chatPrefix.length);

          if (rpc === 'GetChats') {
            const request = payload as { pageSize?: number; pageToken?: string };
            const pageSize = clampPageSize(request.pageSize, 20);
            const offset = parsePageToken(request.pageToken) ?? 0;
            const chats = Array.from(chatStore.values())
              .map(buildChatResponse)
              .sort((a, b) => {
                const aTime = Date.parse(a.updatedAt);
                const bTime = Date.parse(b.updatedAt);
                const aValue = Number.isFinite(aTime) ? aTime : 0;
                const bValue = Number.isFinite(bTime) ? bTime : 0;
                return bValue - aValue;
              });
            const pageChats = chats.slice(offset, offset + pageSize);
            const nextOffset = offset + pageSize;
            const response: { chats: Chat[]; nextPageToken?: string } = {
              chats: pageChats,
            };
            if (nextOffset < chats.length) response.nextPageToken = String(nextOffset);
            return sendJson(res, 200, response);
          }

          if (rpc === 'GetMessages') {
            const request = payload as { chatId?: string; pageSize?: number; pageToken?: string };
            const chatId = request.chatId;
            if (!chatId || !chatStore.has(chatId)) {
              return sendJson(res, 404, { code: 'not_found', message: 'chat not found' });
            }
            const messages = messagesByChat.get(chatId) ?? [];
            const pageSize = clampPageSize(request.pageSize, 30);
            const endIndex = parsePageToken(request.pageToken) ?? messages.length;
            const boundedEnd = Math.min(Math.max(endIndex, 0), messages.length);
            const startIndex = Math.max(0, boundedEnd - pageSize);
            const pageMessages = messages.slice(startIndex, boundedEnd);
            const response: { messages: ChatMessage[]; nextPageToken?: string; unreadCount?: number } = {
              messages: pageMessages.map(cloneChatMessage),
            };
            if (startIndex > 0) response.nextPageToken = String(startIndex);
            const unreadCount = unreadIdsByChat.get(chatId)?.size ?? 0;
            if (unreadCount > 0) response.unreadCount = unreadCount;
            return sendJson(res, 200, response);
          }

          if (rpc === 'SendMessage') {
            const request = payload as { chatId?: string; body?: string; fileIds?: string[] };
            const chatId = request.chatId;
            if (!chatId || !chatStore.has(chatId)) {
              return sendJson(res, 404, { code: 'not_found', message: 'chat not found' });
            }
            const nextMessage: ChatMessage = {
              id: randomUUID(),
              chatId,
              senderId: casey.id,
              body: typeof request.body === 'string' ? request.body : '',
              fileIds: Array.isArray(request.fileIds)
                ? request.fileIds.filter((id): id is string => typeof id === 'string')
                : [],
              createdAt: new Date().toISOString(),
            };
            const messages = messagesByChat.get(chatId) ?? [];
            messages.push(nextMessage);
            messagesByChat.set(chatId, messages);

            const chat = chatStore.get(chatId);
            if (chat) {
              chatStore.set(chatId, {
                ...chat,
                updatedAt: nextMessage.createdAt,
              });
            }

            return sendJson(res, 200, { message: cloneChatMessage(nextMessage) });
          }

          if (rpc === 'CreateChat') {
            const request = payload as { participantIds?: string[] };
            const participantIds = Array.isArray(request.participantIds)
              ? request.participantIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
              : [];
            const createdAt = new Date().toISOString();
            const participantSet = new Set([casey.id, ...participantIds]);
            const participants = Array.from(participantSet).map((id) => ({
              id,
              joinedAt: createdAt,
            }));
            const chat: Chat = {
              id: randomUUID(),
              participants,
              createdAt,
              updatedAt: createdAt,
            };
            chatStore.set(chat.id, chat);
            messagesByChat.set(chat.id, []);
            unreadIdsByChat.set(chat.id, new Set());
            return sendJson(res, 200, { chat: buildChatResponse(chat) });
          }

          if (rpc === 'MarkAsRead') {
            const request = payload as { chatId?: string; messageIds?: string[] };
            const chatId = request.chatId;
            if (!chatId || !chatStore.has(chatId)) {
              return sendJson(res, 404, { code: 'not_found', message: 'chat not found' });
            }
            const messageIds = Array.isArray(request.messageIds)
              ? request.messageIds.filter((id): id is string => typeof id === 'string')
              : [];
            const unreadIds = new Set(unreadIdsByChat.get(chatId) ?? []);
            let readCount = 0;
            messageIds.forEach((id) => {
              if (unreadIds.delete(id)) {
                readCount += 1;
              }
            });
            unreadIdsByChat.set(chatId, unreadIds);
            return sendJson(res, 200, { readCount });
          }

          return sendJson(res, 404, { code: 'not_found', message: 'unknown method' });
        }

        const usersPrefix = '/api/agynio.api.gateway.v1.UsersGateway/';
        if (pathname.startsWith(usersPrefix)) {
          if (method !== 'POST') {
            return sendJson(res, 405, { code: 'invalid_argument', message: 'Method not allowed' });
          }

          let payload: unknown;
          try {
            payload = await readBody(req);
          } catch (_error) {
            return sendJson(res, 400, { code: 'invalid_argument', message: 'Invalid JSON payload' });
          }

          const rpc = pathname.slice(usersPrefix.length);
          if (rpc === 'BatchGetUsers') {
            const request = payload as { identityIds?: string[] };
            const identityIds = Array.isArray(request.identityIds)
              ? request.identityIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
              : [];
            const identityIdSet = new Set(identityIds);
            const users: UserInfo[] = mockUsers
              .filter((user) => identityIdSet.has(user.id))
              .map((user) => ({
                meta: { id: user.id },
                name: user.name,
                email: user.email,
              }));
            return sendJson(res, 200, { users });
          }

          return sendJson(res, 404, { code: 'not_found', message: 'unknown method' });
        }

        const agentsPrefix = '/api/agynio.api.gateway.v1.AgentsGateway/';
        if (pathname.startsWith(agentsPrefix)) {
          if (method !== 'POST') {
            return sendJson(res, 405, { code: 'invalid_argument', message: 'Method not allowed' });
          }

          let payload: unknown;
          try {
            payload = await readBody(req);
          } catch (_error) {
            return sendJson(res, 400, { code: 'invalid_argument', message: 'Invalid JSON payload' });
          }

          const rpc = pathname.slice(agentsPrefix.length);
          if (rpc === 'ListAgents') {
            const request = payload as { organizationId?: string; pageSize?: number; pageToken?: string };
            if (typeof request.organizationId !== 'string' || request.organizationId.trim().length === 0) {
              return sendJson(res, 400, { code: 'invalid_argument', message: 'organizationId is required' });
            }
            const pageSize = clampPageSize(request.pageSize, 50);
            const offset = parsePageToken(request.pageToken) ?? 0;
            return sendJson(res, 200, buildAgentsResponse(agentStore, offset, pageSize));
          }

          if (rpc === 'CreateAgent') {
            const request = payload as {
              name?: string;
              role?: string;
            };
            if (typeof request.name !== 'string' || request.name.trim().length === 0) {
              return sendJson(res, 400, { code: 'invalid_argument', message: 'name is required' });
            }
            const agent = {
              id: randomUUID(),
              name: request.name.trim(),
              role: typeof request.role === 'string' && request.role.trim().length > 0
                ? request.role.trim()
                : 'Assistant',
            };
            agentStore.push(agent);
            return sendJson(res, 200, { agent: mapAgentToAgent(agent) });
          }

          if (rpc === 'DeleteAgent') {
            const request = payload as { id?: string };
            if (typeof request.id !== 'string' || request.id.trim().length === 0) {
              return sendJson(res, 400, { code: 'invalid_argument', message: 'id is required' });
            }
            const index = agentStore.findIndex((agent) => agent.id === request.id);
            if (index === -1) {
              return sendJson(res, 404, { code: 'not_found', message: 'agent not found' });
            }
            agentStore.splice(index, 1);
            return sendJson(res, 200, {});
          }

          return sendJson(res, 404, { code: 'not_found', message: 'unknown method' });
        }

        const organizationsPrefix = '/api/agynio.api.gateway.v1.OrganizationsGateway/';
        if (pathname.startsWith(organizationsPrefix)) {
          if (method !== 'POST') {
            return sendJson(res, 405, { code: 'invalid_argument', message: 'Method not allowed' });
          }

          let payload: unknown;
          try {
            payload = await readBody(req);
          } catch (_error) {
            return sendJson(res, 400, { code: 'invalid_argument', message: 'Invalid JSON payload' });
          }

          const rpc = pathname.slice(organizationsPrefix.length);
          if (rpc === 'CreateOrganization') {
            const request = payload as { name?: string };
            const name = typeof request.name === 'string' ? request.name.trim() : '';
            if (!name) {
              return sendJson(res, 400, { code: 'invalid_argument', message: 'name is required' });
            }
            const timestamp = new Date().toISOString();
            const organization: Organization = {
              id: randomUUID(),
              name,
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            organizations.push(organization);
            return sendJson(res, 200, { organization: { ...organization } });
          }

          if (rpc === 'ListAccessibleOrganizations') {
            return sendJson(res, 200, {
              organizations: organizations.map((organization) => ({ ...organization })),
            });
          }

          return sendJson(res, 404, { code: 'not_found', message: 'unknown method' });
        }

        if (pathname === '/api/files/v1/files' && method === 'POST') {
          const record: FileRecord = {
            id: randomUUID(),
            filename: 'upload.bin',
            contentType: 'application/octet-stream',
            sizeBytes: 0,
            createdAt: new Date().toISOString(),
          };
          return sendJson(res, 200, record);
        }

        if (method === 'GET' && pathname === '/api/graph') {
          const graph: PersistedGraph = {
            ...mockGraph,
            nodes: mockGraph.nodes.map((node) => ({ ...node })),
            edges: mockGraph.edges.map((edge) => ({ ...edge })),
            variables: mockGraph.variables ? mockGraph.variables.map((variable) => ({ ...variable })) : [],
          };
          return sendJson(res, 200, graph);
        }

        if (method === 'GET' && pathname === '/api/graph/templates') {
          const templates: TemplateSchema[] = mockTemplates.map((template) => ({
            ...template,
            sourcePorts: template.sourcePorts ? [...template.sourcePorts] : undefined,
            targetPorts: template.targetPorts ? [...template.targetPorts] : undefined,
            capabilities: template.capabilities ? { ...template.capabilities } : undefined,
          }));
          return sendJson(res, 200, templates);
        }

        return next();
      });
    },
  };
}
