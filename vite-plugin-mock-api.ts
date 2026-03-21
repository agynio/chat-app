import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin } from 'vite';
import type { ThreadMetrics, ThreadNode, ThreadReminder, RunMeta, RunMessageItem } from './src/api/types/agents';
import type { Chat, ChatMessage } from './src/api/types/chat';
import type { TemplateSchema } from './src/api/types/graph';
import type { PersistedGraph } from './src/types/graph';
import type { ContainerItem, ContainerEventItem, ContainerTerminalSessionResponse } from './src/api/modules/containers';

type ThreadTreeItem = ThreadNode & { children?: ThreadTreeItem[]; hasChildren?: boolean };

const now = new Date();
const iso = (minutesOffset: number) => new Date(now.getTime() + minutesOffset * 60 * 1000).toISOString();

const threadOneId = '11111111-1111-1111-1111-111111111111';
const threadTwoId = '22222222-2222-2222-2222-222222222222';
const threadThreeId = '33333333-3333-3333-3333-333333333333';

const chatSelfId = 'casey@example.com';
const chatOneId = '44444444-4444-4444-4444-444444444444';
const chatTwoId = '55555555-5555-5555-5555-555555555555';
const chatThreeId = '66666666-6666-6666-6666-666666666666';

const defaultMetrics: ThreadMetrics = {
  remindersCount: 0,
  containersCount: 0,
  activity: 'idle',
  runsCount: 0,
};

const threadStore = new Map<string, ThreadNode>([
  [
    threadOneId,
    {
      id: threadOneId,
      alias: 'Q2 campaign brief',
      summary: 'Draft a Q2 marketing brief for the launch campaign.',
      status: 'open',
      parentId: null,
      createdAt: iso(-180),
      metrics: {
        remindersCount: 1,
        containersCount: 1,
        activity: 'waiting',
        runsCount: 2,
      },
      agentRole: 'Assistant',
      agentName: 'Campaign Planner',
    },
  ],
  [
    threadTwoId,
    {
      id: threadTwoId,
      alias: 'Customer follow-up',
      summary: 'Draft a follow-up note for the ACME renewal.',
      status: 'closed',
      parentId: null,
      createdAt: iso(-420),
      metrics: {
        remindersCount: 0,
        containersCount: 0,
        activity: 'idle',
        runsCount: 1,
      },
      agentRole: 'Assistant',
      agentName: 'Account Concierge',
    },
  ],
  [
    threadThreeId,
    {
      id: threadThreeId,
      alias: 'Q2 brief review',
      summary: 'Review edits and finalize the Q2 campaign outline.',
      status: 'open',
      parentId: threadOneId,
      createdAt: iso(-90),
      metrics: {
        remindersCount: 0,
        containersCount: 0,
        activity: 'working',
        runsCount: 1,
      },
      agentRole: 'Assistant',
      agentName: 'Campaign Planner',
    },
  ],
]);

const chatStore = new Map<string, Chat>([
  [
    chatOneId,
    {
      id: chatOneId,
      participants: [
        { id: chatSelfId, joinedAt: iso(-300) },
        { id: 'planner@agyn.io', joinedAt: iso(-298) },
        { id: 'designer@agyn.io', joinedAt: iso(-296) },
      ],
      createdAt: iso(-300),
      updatedAt: iso(-120),
    },
  ],
  [
    chatTwoId,
    {
      id: chatTwoId,
      participants: [
        { id: chatSelfId, joinedAt: iso(-220) },
        { id: 'ops@agyn.io', joinedAt: iso(-218) },
      ],
      createdAt: iso(-220),
      updatedAt: iso(-55),
    },
  ],
  [
    chatThreeId,
    {
      id: chatThreeId,
      participants: [
        { id: chatSelfId, joinedAt: iso(-140) },
        { id: 'support@agyn.io', joinedAt: iso(-138) },
      ],
      createdAt: iso(-140),
      updatedAt: iso(-15),
    },
  ],
]);

const chatMessagesByChat = new Map<string, ChatMessage[]>([
  [
    chatOneId,
    [
      {
        id: 'chat-1-msg-1',
        chatId: chatOneId,
        senderId: chatSelfId,
        body: 'Can you share the brief outline when ready?',
        fileIds: [],
        createdAt: iso(-200),
      },
      {
        id: 'chat-1-msg-2',
        chatId: chatOneId,
        senderId: 'planner@agyn.io',
        body: 'Sure, drafting the outline now and will send shortly.',
        fileIds: [],
        createdAt: iso(-190),
      },
      {
        id: 'chat-1-msg-3',
        chatId: chatOneId,
        senderId: 'designer@agyn.io',
        body: 'I can add creative deliverables once the outline is set.',
        fileIds: [],
        createdAt: iso(-170),
      },
      {
        id: 'chat-1-msg-4',
        chatId: chatOneId,
        senderId: chatSelfId,
        body: 'Please include launch phases and key stakeholders.',
        fileIds: [],
        createdAt: iso(-150),
      },
      {
        id: 'chat-1-msg-5',
        chatId: chatOneId,
        senderId: 'planner@agyn.io',
        body: 'Outline updated with phases, stakeholders, and deliverables.',
        fileIds: [],
        createdAt: iso(-120),
      },
    ],
  ],
  [
    chatTwoId,
    [
      {
        id: 'chat-2-msg-1',
        chatId: chatTwoId,
        senderId: 'ops@agyn.io',
        body: 'Any updates on the ops checklist for the release?',
        fileIds: [],
        createdAt: iso(-95),
      },
      {
        id: 'chat-2-msg-2',
        chatId: chatTwoId,
        senderId: chatSelfId,
        body: 'Working on the checklist today. Will share a draft soon.',
        fileIds: [],
        createdAt: iso(-80),
      },
      {
        id: 'chat-2-msg-3',
        chatId: chatTwoId,
        senderId: 'ops@agyn.io',
        body: 'Great, I added infra notes in the shared doc.',
        fileIds: ['file-ops-1'],
        createdAt: iso(-70),
      },
      {
        id: 'chat-2-msg-4',
        chatId: chatTwoId,
        senderId: 'ops@agyn.io',
        body: 'Let me know if you need more detail on the rollout plan.',
        fileIds: [],
        createdAt: iso(-55),
      },
    ],
  ],
  [
    chatThreeId,
    [
      {
        id: 'chat-3-msg-1',
        chatId: chatThreeId,
        senderId: 'support@agyn.io',
        body: 'Drafted the FAQ updates for the release. Ready for review.',
        fileIds: [],
        createdAt: iso(-40),
      },
      {
        id: 'chat-3-msg-2',
        chatId: chatThreeId,
        senderId: chatSelfId,
        body: 'Thanks, I will review and send notes by tomorrow.',
        fileIds: [],
        createdAt: iso(-30),
      },
      {
        id: 'chat-3-msg-3',
        chatId: chatThreeId,
        senderId: 'support@agyn.io',
        body: 'Sounds good. Also flagged two edge cases for docs.',
        fileIds: [],
        createdAt: iso(-15),
      },
    ],
  ],
]);

const chatUnreadIdsByChat = new Map<string, Set<string>>([
  [chatOneId, new Set(['chat-1-msg-5'])],
  [chatTwoId, new Set(['chat-2-msg-3', 'chat-2-msg-4'])],
  [chatThreeId, new Set(['chat-3-msg-3'])],
]);

const childrenByThread = new Map<string, string[]>([[threadOneId, [threadThreeId]]]);

const runOneId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const runTwoId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const runThreeId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const runsByThread = new Map<string, RunMeta[]>([
  [
    threadOneId,
    [
      {
        id: runOneId,
        threadId: threadOneId,
        status: 'finished',
        createdAt: iso(-160),
        updatedAt: iso(-150),
      },
      {
        id: runTwoId,
        threadId: threadOneId,
        status: 'running',
        createdAt: iso(-20),
        updatedAt: iso(-2),
      },
    ],
  ],
  [
    threadTwoId,
    [
      {
        id: runThreeId,
        threadId: threadTwoId,
        status: 'finished',
        createdAt: iso(-380),
        updatedAt: iso(-360),
      },
    ],
  ],
  [threadThreeId, []],
]);

type RunMessageBucket = {
  input: RunMessageItem[];
  injected: RunMessageItem[];
  output: RunMessageItem[];
};

const runMessagesByRunId = new Map<string, RunMessageBucket>([
  [
    runOneId,
    {
      input: [
        {
          id: 'msg-1',
          kind: 'user',
          text: 'Draft a Q2 marketing brief focused on the new launch.',
          source: { channel: 'chat' },
          createdAt: iso(-159),
        },
      ],
      injected: [],
      output: [
        {
          id: 'msg-2',
          kind: 'assistant',
          text: 'Here is a draft brief with positioning, goals, and launch phases.',
          source: { channel: 'llm' },
          createdAt: iso(-158),
        },
      ],
    },
  ],
  [
    runTwoId,
    {
      input: [
        {
          id: 'msg-3',
          kind: 'user',
          text: 'Add a section on creative deliverables and internal review dates.',
          source: { channel: 'chat' },
          createdAt: iso(-19),
        },
      ],
      injected: [],
      output: [
        {
          id: 'msg-4',
          kind: 'assistant',
          text: 'Updated draft includes a deliverables checklist and review cadence.',
          source: { channel: 'llm' },
          createdAt: iso(-18),
        },
      ],
    },
  ],
  [
    runThreeId,
    {
      input: [
        {
          id: 'msg-5',
          kind: 'user',
          text: 'Create a renewal follow-up for ACME with a friendly tone.',
          source: { channel: 'chat' },
          createdAt: iso(-379),
        },
      ],
      injected: [],
      output: [
        {
          id: 'msg-6',
          kind: 'assistant',
          text: 'Drafted a friendly renewal follow-up highlighting next steps.',
          source: { channel: 'llm' },
          createdAt: iso(-378),
        },
      ],
    },
  ],
]);

const reminders: ThreadReminder[] = [
  {
    id: 'reminder-1',
    threadId: threadOneId,
    note: 'Send the draft to marketing by EOD.',
    at: iso(240),
    createdAt: iso(-120),
    completedAt: null,
    cancelledAt: null,
    runId: runTwoId,
    status: 'scheduled',
  },
];

const queuedMessagesByThread = new Map<string, Array<{ id: string; text: string; enqueuedAt?: string }>>([
  [threadOneId, []],
  [threadTwoId, []],
  [threadThreeId, []],
]);

const containers: ContainerItem[] = [
  {
    containerId: 'container-1',
    threadId: threadOneId,
    image: 'ghcr.io/agyn/workspace:latest',
    name: 'workspace-q2',
    status: 'running',
    startedAt: iso(-140),
    lastUsedAt: iso(-8),
    killAfterAt: iso(180),
    role: 'workspace',
  },
];

const containerEventsById = new Map<string, ContainerEventItem[]>([
  [
    'container-1',
    [
      {
        id: 'evt-1',
        containerId: 'container-1',
        eventType: 'start',
        exitCode: null,
        signal: null,
        health: 'healthy',
        reason: null,
        message: 'Container started.',
        createdAt: iso(-140),
      },
      {
        id: 'evt-2',
        containerId: 'container-1',
        eventType: 'exec',
        exitCode: 0,
        signal: null,
        health: 'healthy',
        reason: null,
        message: 'Executed Q2 brief generator.',
        createdAt: iso(-30),
      },
    ],
  ],
]);

const templates: TemplateSchema[] = [
  {
    name: 'chat-agent',
    title: 'Chat Agent',
    kind: 'agent',
    description: 'Primary chat agent node for handling conversations.',
    sourcePorts: ['output'],
    targetPorts: ['input'],
    capabilities: { pausable: true, provisionable: true },
  },
  {
    name: 'remind-me',
    title: 'Reminder',
    kind: 'tool',
    description: 'Schedules reminders for a thread.',
    sourcePorts: ['output'],
    targetPorts: ['input'],
  },
];

const graph: PersistedGraph = {
  name: 'Chat Graph',
  version: 1,
  updatedAt: iso(-5),
  nodes: [
    {
      id: 'node-agent-1',
      template: 'chat-agent',
      position: { x: 120, y: 80 },
      config: { title: 'Chat Agent', model: 'gpt-4.1-mini' },
    },
    {
      id: 'node-reminder-1',
      template: 'remind-me',
      position: { x: 480, y: 80 },
      config: { title: 'Reminder Tool' },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'node-agent-1',
      sourceHandle: 'output',
      target: 'node-reminder-1',
      targetHandle: 'input',
    },
  ],
  variables: [
    { key: 'tone', value: 'friendly' },
  ],
};

function getThreadChildren(threadId: string): ThreadNode[] {
  const childIds = childrenByThread.get(threadId) ?? [];
  return childIds.map((id) => threadStore.get(id)).filter(Boolean) as ThreadNode[];
}

function buildThreadTree(node: ThreadNode): ThreadTreeItem {
  const children = getThreadChildren(node.id).map((child) => buildThreadTree(child));
  return {
    ...node,
    children: children.length ? children : undefined,
    hasChildren: children.length > 0,
  };
}

function listRootThreads(status: string | null): ThreadNode[] {
  const allThreads = Array.from(threadStore.values());
  return allThreads.filter((thread) => {
    if (thread.parentId) return false;
    if (!status || status === 'all') return true;
    return thread.status === status;
  });
}

function listThreadsByStatus(status: string | null): ThreadNode[] {
  const allThreads = Array.from(threadStore.values());
  return allThreads.filter((thread) => {
    if (!status || status === 'all') return true;
    return thread.status === status;
  });
}

function summarize(text: string | undefined | null): string {
  if (!text) return 'New thread';
  const trimmed = text.trim();
  if (!trimmed) return 'New thread';
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

function notFound(res: ServerResponse) {
  sendJson(res, 404, { error: 'Not found' });
}

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
        const chatPrefix = '/apiv2/agynio.api.gateway.v1.ChatGateway/';

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
            const chats = Array.from(chatStore.values()).sort((a, b) => {
              const aTime = Date.parse(a.updatedAt);
              const bTime = Date.parse(b.updatedAt);
              const aValue = Number.isFinite(aTime) ? aTime : 0;
              const bValue = Number.isFinite(bTime) ? bTime : 0;
              return bValue - aValue;
            });
            const pageChats = chats.slice(offset, offset + pageSize);
            const nextOffset = offset + pageSize;
            const response: { chats: Chat[]; nextPageToken?: string } = { chats: pageChats };
            if (nextOffset < chats.length) response.nextPageToken = String(nextOffset);
            return sendJson(res, 200, response);
          }

          if (rpc === 'GetMessages') {
            const request = payload as { chatId?: string; pageSize?: number; pageToken?: string };
            const chatId = request.chatId;
            if (!chatId || !chatStore.has(chatId)) {
              return sendJson(res, 404, { code: 'not_found', message: 'chat not found' });
            }
            const messages = chatMessagesByChat.get(chatId) ?? [];
            const pageSize = clampPageSize(request.pageSize, 30);
            const endIndex = parsePageToken(request.pageToken) ?? messages.length;
            const boundedEnd = Math.min(Math.max(endIndex, 0), messages.length);
            const startIndex = Math.max(0, boundedEnd - pageSize);
            const pageMessages = messages.slice(startIndex, boundedEnd);
            const response: { messages: ChatMessage[]; nextPageToken?: string; unreadCount?: number } = {
              messages: pageMessages,
            };
            if (startIndex > 0) response.nextPageToken = String(startIndex);
            const unreadCount = chatUnreadIdsByChat.get(chatId)?.size ?? 0;
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
              senderId: chatSelfId,
              body: typeof request.body === 'string' ? request.body : '',
              fileIds: Array.isArray(request.fileIds)
                ? request.fileIds.filter((id): id is string => typeof id === 'string')
                : [],
              createdAt: new Date().toISOString(),
            };
            const messages = chatMessagesByChat.get(chatId) ?? [];
            messages.push(nextMessage);
            chatMessagesByChat.set(chatId, messages);
            const chat = chatStore.get(chatId);
            if (chat) {
              chatStore.set(chatId, { ...chat, updatedAt: nextMessage.createdAt });
            }
            return sendJson(res, 200, { message: nextMessage });
          }

          if (rpc === 'CreateChat') {
            const request = payload as { participantIds?: string[] };
            const participantIds = Array.isArray(request.participantIds)
              ? request.participantIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
              : [];
            const createdAt = new Date().toISOString();
            const participants = Array.from(new Set([chatSelfId, ...participantIds])).map((id) => ({
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
            chatMessagesByChat.set(chat.id, []);
            chatUnreadIdsByChat.set(chat.id, new Set());
            return sendJson(res, 200, { chat });
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
            const unreadIds = new Set(chatUnreadIdsByChat.get(chatId) ?? []);
            let readCount = 0;
            messageIds.forEach((id) => {
              if (unreadIds.delete(id)) {
                readCount += 1;
              }
            });
            chatUnreadIdsByChat.set(chatId, unreadIds);
            return sendJson(res, 200, { readCount });
          }

          return sendJson(res, 404, { code: 'not_found', message: 'unknown method' });
        }

        if (!pathname.startsWith('/api/')) return next();

        if (method === 'GET' && pathname === '/api/graph') {
          return sendJson(res, 200, graph);
        }

        if (method === 'GET' && pathname === '/api/graph/templates') {
          return sendJson(res, 200, templates);
        }

        if (pathname === '/api/agents/threads' && method === 'GET') {
          const status = url.searchParams.get('status');
          const items = listRootThreads(status);
          return sendJson(res, 200, { items });
        }

        if (pathname === '/api/agents/threads' && method === 'POST') {
          const payload = (await readBody(req)) as {
            agentNodeId?: string;
            text?: string;
            parentId?: string;
            alias?: string;
          };
          const id = randomUUID();
          const summary = summarize(payload.text);
          const alias = payload.alias?.trim() || summary;
          const createdAt = new Date().toISOString();
          const nextThread: ThreadNode = {
            id,
            alias,
            summary,
            status: 'open',
            parentId: payload.parentId ?? null,
            createdAt,
            metrics: { ...defaultMetrics },
            agentRole: 'Assistant',
            agentName: payload.agentNodeId || 'Chat Agent',
          };
          threadStore.set(id, nextThread);
          if (payload.parentId) {
            const children = childrenByThread.get(payload.parentId) ?? [];
            childrenByThread.set(payload.parentId, [...children, id]);
          }
          queuedMessagesByThread.set(id, []);
          return sendJson(res, 200, { id });
        }

        if (pathname === '/api/agents/threads/tree' && method === 'GET') {
          const status = url.searchParams.get('status');
          const roots = listRootThreads(status);
          const items = roots.map((node) => buildThreadTree(node));
          return sendJson(res, 200, { items });
        }

        if (pathname.startsWith('/api/agents/threads/')) {
          const segments = pathname.split('/').filter(Boolean);
          const threadId = segments[3];
          const rest = segments.slice(4);
          if (!threadId) return notFound(res);

          if (rest.length === 0 && method === 'GET') {
            const thread = threadStore.get(threadId);
            if (!thread) return notFound(res);
            return sendJson(res, 200, thread);
          }

          if (rest.length === 0 && (method === 'PATCH' || method === 'PUT')) {
            const thread = threadStore.get(threadId);
            if (!thread) return notFound(res);
            const payload = (await readBody(req)) as { status?: ThreadNode['status'] };
            const next = { ...thread, status: payload.status ?? thread.status };
            threadStore.set(threadId, next);
            return sendJson(res, 200, next);
          }

          if (rest[0] === 'children' && method === 'GET') {
            const status = url.searchParams.get('status');
            const children = getThreadChildren(threadId).filter((thread) => {
              if (!status || status === 'all') return true;
              return thread.status === status;
            });
            return sendJson(res, 200, { items: children });
          }

          if (rest[0] === 'tree' && method === 'GET') {
            const thread = threadStore.get(threadId);
            if (!thread) return notFound(res);
            return sendJson(res, 200, buildThreadTree(thread));
          }

          if (rest[0] === 'queued-messages' && method === 'GET') {
            const items = queuedMessagesByThread.get(threadId) ?? [];
            return sendJson(res, 200, { items });
          }

          if (rest[0] === 'queued-messages' && method === 'DELETE') {
            const items = queuedMessagesByThread.get(threadId) ?? [];
            queuedMessagesByThread.set(threadId, []);
            return sendJson(res, 200, { clearedCount: items.length });
          }

          if (rest[0] === 'messages' && method === 'GET') {
            return sendJson(res, 200, { items: [] });
          }

          if (rest[0] === 'messages' && method === 'POST') {
            return sendJson(res, 200, { ok: true });
          }

          if (rest[0] === 'runs' && method === 'GET') {
            const items = runsByThread.get(threadId) ?? [];
            return sendJson(res, 200, { items });
          }

          if (rest[0] === 'metrics' && method === 'GET') {
            const thread = threadStore.get(threadId);
            const metrics = thread?.metrics ?? defaultMetrics;
            return sendJson(res, 200, metrics);
          }

          if (rest[0] === 'reminders' && rest[1] === 'cancel' && method === 'POST') {
            const updated = reminders.filter((reminder) => reminder.threadId === threadId).length;
            return sendJson(res, 200, { cancelledDb: updated, clearedRuntime: 0 });
          }
        }

        if (pathname.startsWith('/api/agents/runs/') && method === 'GET') {
          const segments = pathname.split('/').filter(Boolean);
          const runId = segments[3];
          const rest = segments.slice(4);
          if (!runId) return notFound(res);

          if (rest[0] === 'messages') {
            const type = url.searchParams.get('type') as keyof RunMessageBucket | null;
            const bucket = runMessagesByRunId.get(runId);
            if (!bucket) return sendJson(res, 200, { items: [] });
            if (!type) {
              const items = [...bucket.input, ...bucket.injected, ...bucket.output];
              return sendJson(res, 200, { items });
            }
            const items = bucket[type] ?? [];
            return sendJson(res, 200, { items });
          }
        }

        if (pathname === '/api/agents/reminders' && method === 'GET') {
          const filter = url.searchParams.get('filter') ?? 'all';
          const threadId = url.searchParams.get('threadId');
          const page = parseNumber(url.searchParams.get('page'), 1);
          const pageSize = parseNumber(url.searchParams.get('pageSize'), reminders.length || 1);
          let items = reminders.slice();

          if (threadId) {
            items = items.filter((reminder) => reminder.threadId === threadId);
          }

          if (filter === 'active') {
            items = items.filter((reminder) => !reminder.completedAt && !reminder.cancelledAt);
          }
          if (filter === 'completed') {
            items = items.filter((reminder) => Boolean(reminder.completedAt));
          }
          if (filter === 'cancelled') {
            items = items.filter((reminder) => Boolean(reminder.cancelledAt));
          }

          const totalCount = items.length;
          const pageCount = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
          const start = (page - 1) * pageSize;
          const pageItems = items.slice(start, start + pageSize);
          const countsByStatus = items.reduce(
            (acc, reminder) => {
              if (reminder.cancelledAt) acc.cancelled += 1;
              else if (reminder.completedAt) acc.executed += 1;
              else acc.scheduled += 1;
              return acc;
            },
            { scheduled: 0, executed: 0, cancelled: 0 },
          );

          return sendJson(res, 200, {
            items: pageItems,
            page,
            pageSize,
            totalCount,
            pageCount,
            countsByStatus,
            sortApplied: { key: 'latest', order: 'desc' },
          });
        }

        if (pathname.startsWith('/api/agents/reminders/') && pathname.endsWith('/cancel') && method === 'POST') {
          const segments = pathname.split('/').filter(Boolean);
          const reminderId = segments[3];
          const reminder = reminders.find((item) => item.id === reminderId);
          if (reminder) {
            reminder.cancelledAt = new Date().toISOString();
            reminder.status = 'cancelled';
          }
          return sendJson(res, 200, { ok: true, threadId: reminder?.threadId ?? threadOneId });
        }

        if (pathname === '/api/containers' && method === 'GET') {
          const threadId = url.searchParams.get('threadId');
          const status = url.searchParams.get('status');
          let items = containers.slice();
          if (threadId) {
            items = items.filter((item) => item.threadId === threadId);
          }
          if (status) {
            items = items.filter((item) => item.status === status);
          }
          return sendJson(res, 200, { items });
        }

        if (pathname.startsWith('/api/containers/') && pathname.endsWith('/events') && method === 'GET') {
          const segments = pathname.split('/').filter(Boolean);
          const containerId = segments[2];
          const items = containerEventsById.get(containerId) ?? [];
          return sendJson(res, 200, {
            items,
            page: {
              limit: items.length,
              order: 'desc',
              nextBefore: null,
              nextAfter: null,
            },
          });
        }

        if (pathname.startsWith('/api/containers/') && pathname.endsWith('/terminal/sessions') && method === 'POST') {
          const segments = pathname.split('/').filter(Boolean);
          const containerId = segments[2];
          const response: ContainerTerminalSessionResponse = {
            sessionId: randomUUID(),
            token: randomUUID(),
            wsUrl: `ws://localhost:5173/api/containers/${containerId}/terminal/ws`,
            expiresAt: iso(30),
            negotiated: { shell: 'bash', cols: 120, rows: 32 },
          };
          return sendJson(res, 200, response);
        }

        if (pathname.startsWith('/api/containers/') && method === 'DELETE') {
          return sendJson(res, 200, { ok: true });
        }

        if (pathname === '/api/agents/threads/metrics' && method === 'GET') {
          const status = url.searchParams.get('status');
          const items = listThreadsByStatus(status);
          return sendJson(res, 200, { items });
        }

        return next();
      });
    },
  };
}
