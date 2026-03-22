import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin } from 'vite';
import type { ThreadMetrics, ThreadNode, ThreadReminder, RunMeta, RunMessageItem } from './src/api/types/agents';
import type { TemplateSchema } from './src/api/types/graph';
import type { PersistedGraph } from './src/types/graph';
import type { ContainerItem, ContainerEventItem, ContainerTerminalSessionResponse } from './src/api/modules/containers';

type ThreadTreeItem = ThreadNode & { children?: ThreadTreeItem[]; hasChildren?: boolean };

const now = new Date();
const iso = (minutesOffset: number) => new Date(now.getTime() + minutesOffset * 60 * 1000).toISOString();

const threadOneId = '11111111-1111-1111-1111-111111111111';
const threadTwoId = '22222222-2222-2222-2222-222222222222';
const threadThreeId = '33333333-3333-3333-3333-333333333333';

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
