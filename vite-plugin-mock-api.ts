import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin } from 'vite';
import type { AgentSummary } from './src/api/types/agents';
import type { ConversationMessageRecord, ConversationSummary } from './src/api/types/conversations';
import type { FileRecord } from './src/api/types/files';
import type { TemplateSchema } from './src/api/types/graph';
import type { PersistedGraph } from './src/types/graph';
import { agents as mockAgents, agentAccountId, agentCampaignId, agentResearchId } from './src/api/mock-data/agents';
import { conversationSeeds, conversationOneId, conversationTwoId, conversationThreeId } from './src/api/mock-data/conversations';
import { graph as mockGraph } from './src/api/mock-data/graph';
import { templates as mockTemplates } from './src/api/mock-data/templates';
import { stubUsers } from './src/data/stub-users';

const now = new Date();
const iso = (minutesOffset: number) => new Date(now.getTime() + minutesOffset * 60 * 1000).toISOString();

const [casey, alex, jamie] = stubUsers;

const conversationStore = new Map<string, ConversationSummary>(
  conversationSeeds.map((seed) => [
    seed.id,
    {
      id: seed.id,
      participants: seed.participants.map((participant) => ({ ...participant })),
      createdAt: seed.createdAt,
      updatedAt: seed.updatedAt,
      summary: seed.summary,
      status: seed.status,
    },
  ]),
);

const messagesByConversation = new Map<string, ConversationMessageRecord[]>([
  [
    conversationOneId,
    [
      {
        id: 'conv-1-msg-1',
        conversationId: conversationOneId,
        senderId: casey.id,
        body: 'Draft a Q2 marketing brief focused on the new launch.',
        fileIds: [],
        createdAt: iso(-159),
      },
      {
        id: 'conv-1-msg-2',
        conversationId: conversationOneId,
        senderId: agentCampaignId,
        body: 'Here is a draft brief with positioning, goals, and launch phases.',
        fileIds: [],
        createdAt: iso(-158),
      },
      {
        id: 'conv-1-msg-3',
        conversationId: conversationOneId,
        senderId: casey.id,
        body: 'Add a section on creative deliverables and internal review dates.',
        fileIds: [],
        createdAt: iso(-19),
      },
      {
        id: 'conv-1-msg-4',
        conversationId: conversationOneId,
        senderId: agentCampaignId,
        body: 'Updated draft includes a deliverables checklist and review cadence.',
        fileIds: ['file-brief-1'],
        createdAt: iso(-18),
      },
    ],
  ],
  [
    conversationTwoId,
    [
      {
        id: 'conv-2-msg-1',
        conversationId: conversationTwoId,
        senderId: alex.id,
        body: 'Draft a follow-up note for the ACME renewal.',
        fileIds: [],
        createdAt: iso(-379),
      },
      {
        id: 'conv-2-msg-2',
        conversationId: conversationTwoId,
        senderId: agentAccountId,
        body: 'Drafted a friendly renewal follow-up highlighting next steps.',
        fileIds: [],
        createdAt: iso(-378),
      },
      {
        id: 'conv-2-msg-3',
        conversationId: conversationTwoId,
        senderId: alex.id,
        body: 'Please include pricing highlights and the renewal deadline.',
        fileIds: ['file-acme-1'],
        createdAt: iso(-310),
      },
      {
        id: 'conv-2-msg-4',
        conversationId: conversationTwoId,
        senderId: agentAccountId,
        body: 'Added pricing details, renewal timeline, and next-step CTA.',
        fileIds: [],
        createdAt: iso(-300),
      },
    ],
  ],
  [
    conversationThreeId,
    [
      {
        id: 'conv-3-msg-1',
        conversationId: conversationThreeId,
        senderId: jamie.id,
        body: 'Review edits and finalize the Q2 campaign outline.',
        fileIds: [],
        createdAt: iso(-88),
      },
      {
        id: 'conv-3-msg-2',
        conversationId: conversationThreeId,
        senderId: agentResearchId,
        body: 'Summarized competitive insights and top three growth channels.',
        fileIds: [],
        createdAt: iso(-80),
      },
      {
        id: 'conv-3-msg-3',
        conversationId: conversationThreeId,
        senderId: jamie.id,
        body: 'Can you add a short section on regional rollout considerations?',
        fileIds: [],
        createdAt: iso(-60),
      },
      {
        id: 'conv-3-msg-4',
        conversationId: conversationThreeId,
        senderId: agentResearchId,
        body: 'Added rollout considerations for NA, EMEA, and APAC regions.',
        fileIds: [],
        createdAt: iso(-45),
      },
    ],
  ],
]);

const unreadIdsByConversation = new Map<string, Set<string>>([
  [conversationOneId, new Set(['conv-1-msg-4'])],
  [conversationTwoId, new Set(['conv-2-msg-3', 'conv-2-msg-4'])],
  [conversationThreeId, new Set(['conv-3-msg-4'])],
]);

function summarize(text: string | undefined | null): string {
  if (!text) return 'New conversation';
  const trimmed = text.trim();
  if (!trimmed) return 'New conversation';
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

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

function buildConversationResponse(conversation: ConversationSummary): ConversationSummary {
  return {
    ...conversation,
    participants: conversation.participants.map((participant) => ({ ...participant })),
    unreadCount: unreadIdsByConversation.get(conversation.id)?.size ?? 0,
  };
}

function buildAgentsResponse(agents: AgentSummary[], offset: number, pageSize: number) {
  const pageAgents = agents.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  const response: { agents: AgentSummary[]; nextPageToken?: string } = { agents: pageAgents };
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
            const conversations = Array.from(conversationStore.values())
              .map(buildConversationResponse)
              .sort((a, b) => {
                const aTime = Date.parse(a.updatedAt);
                const bTime = Date.parse(b.updatedAt);
                const aValue = Number.isFinite(aTime) ? aTime : 0;
                const bValue = Number.isFinite(bTime) ? bTime : 0;
                return bValue - aValue;
              });
            const pageConversations = conversations.slice(offset, offset + pageSize);
            const nextOffset = offset + pageSize;
            const response: { conversations: ConversationSummary[]; nextPageToken?: string } = {
              conversations: pageConversations,
            };
            if (nextOffset < conversations.length) response.nextPageToken = String(nextOffset);
            return sendJson(res, 200, response);
          }

          if (rpc === 'GetMessages') {
            const request = payload as { conversationId?: string; pageSize?: number; pageToken?: string };
            const conversationId = request.conversationId;
            if (!conversationId || !conversationStore.has(conversationId)) {
              return sendJson(res, 404, { code: 'not_found', message: 'conversation not found' });
            }
            const messages = messagesByConversation.get(conversationId) ?? [];
            const pageSize = clampPageSize(request.pageSize, 30);
            const endIndex = parsePageToken(request.pageToken) ?? messages.length;
            const boundedEnd = Math.min(Math.max(endIndex, 0), messages.length);
            const startIndex = Math.max(0, boundedEnd - pageSize);
            const pageMessages = messages.slice(startIndex, boundedEnd);
            const response: { messages: ConversationMessageRecord[]; nextPageToken?: string; unreadCount?: number } = {
              messages: pageMessages,
            };
            if (startIndex > 0) response.nextPageToken = String(startIndex);
            const unreadCount = unreadIdsByConversation.get(conversationId)?.size ?? 0;
            if (unreadCount > 0) response.unreadCount = unreadCount;
            return sendJson(res, 200, response);
          }

          if (rpc === 'SendMessage') {
            const request = payload as { conversationId?: string; body?: string; fileIds?: string[] };
            const conversationId = request.conversationId;
            if (!conversationId || !conversationStore.has(conversationId)) {
              return sendJson(res, 404, { code: 'not_found', message: 'conversation not found' });
            }
            const nextMessage: ConversationMessageRecord = {
              id: randomUUID(),
              conversationId,
              senderId: casey.id,
              body: typeof request.body === 'string' ? request.body : '',
              fileIds: Array.isArray(request.fileIds)
                ? request.fileIds.filter((id): id is string => typeof id === 'string')
                : [],
              createdAt: new Date().toISOString(),
            };
            const messages = messagesByConversation.get(conversationId) ?? [];
            messages.push(nextMessage);
            messagesByConversation.set(conversationId, messages);

            const conversation = conversationStore.get(conversationId);
            if (conversation) {
              conversationStore.set(conversationId, {
                ...conversation,
                updatedAt: nextMessage.createdAt,
                summary: summarize(nextMessage.body),
              });
            }

            return sendJson(res, 200, { message: nextMessage });
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
              type: mockAgents.some((agent) => agent.id === id) ? 'agent' : 'user',
            }));
            const conversation: ConversationSummary = {
              id: randomUUID(),
              participants,
              createdAt,
              updatedAt: createdAt,
              summary: null,
              status: 'open',
            };
            conversationStore.set(conversation.id, conversation);
            messagesByConversation.set(conversation.id, []);
            unreadIdsByConversation.set(conversation.id, new Set());
            return sendJson(res, 200, { conversation: buildConversationResponse(conversation) });
          }

          if (rpc === 'MarkAsRead') {
            const request = payload as { conversationId?: string; messageIds?: string[] };
            const conversationId = request.conversationId;
            if (!conversationId || !conversationStore.has(conversationId)) {
              return sendJson(res, 404, { code: 'not_found', message: 'conversation not found' });
            }
            const messageIds = Array.isArray(request.messageIds)
              ? request.messageIds.filter((id): id is string => typeof id === 'string')
              : [];
            const unreadIds = new Set(unreadIdsByConversation.get(conversationId) ?? []);
            let readCount = 0;
            messageIds.forEach((id) => {
              if (unreadIds.delete(id)) {
                readCount += 1;
              }
            });
            unreadIdsByConversation.set(conversationId, unreadIds);
            return sendJson(res, 200, { readCount });
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
            const request = payload as { pageSize?: number; pageToken?: string };
            const pageSize = clampPageSize(request.pageSize, 50);
            const offset = parsePageToken(request.pageToken) ?? 0;
            return sendJson(res, 200, buildAgentsResponse(mockAgents, offset, pageSize));
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
