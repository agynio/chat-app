import { randomUUID } from 'crypto';
import type { Page, Route } from '@playwright/test';
import type { AgentSummary } from '../../src/api/types/agents';
import type { ConversationMessageRecord, ConversationSummary } from '../../src/api/types/conversations';
import { agents as mockAgents, agentAccountId, agentCampaignId, agentResearchId } from '../../src/api/mock-data/agents';
import { conversationSeeds, conversationOneId, conversationTwoId, conversationThreeId } from '../../src/api/mock-data/conversations';
import { stubUsers } from '../../src/data/stub-users';

type JsonBody = Record<string, unknown>;

type MockState = {
  conversationStore: Map<string, ConversationSummary>;
  messagesByConversation: Map<string, ConversationMessageRecord[]>;
  unreadIdsByConversation: Map<string, Set<string>>;
  currentUserId: string;
};

const CHAT_GATEWAY_MATCH = /agynio\.api\.gateway\.v1\.ChatGateway/;
const AGENTS_GATEWAY_MATCH = /agynio\.api\.gateway\.v1\.AgentsGateway/;

function fulfillJson(route: Route, status: number, payload: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function parseRequestBody(route: Route): JsonBody | null {
  const raw = route.request().postData();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as JsonBody;
  } catch (_error) {
    return null;
  }
}

function summarize(text: string | null | undefined): string {
  if (!text) return 'New conversation';
  const trimmed = text.trim();
  if (!trimmed) return 'New conversation';
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

function buildConversationResponse(
  conversation: ConversationSummary,
  unreadIdsByConversation: Map<string, Set<string>>,
): ConversationSummary {
  return {
    ...conversation,
    participants: conversation.participants.map((participant) => ({ ...participant })),
    unreadCount: unreadIdsByConversation.get(conversation.id)?.size ?? 0,
  };
}

function createMockState(): MockState {
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

  return {
    conversationStore,
    messagesByConversation,
    unreadIdsByConversation,
    currentUserId: casey.id,
  };
}

function parseConversationId(payload: JsonBody): string | null {
  const conversationId = payload.conversationId;
  return typeof conversationId === 'string' ? conversationId : null;
}

function getRpcName(route: Route): string {
  const { pathname } = new URL(route.request().url());
  const segments = pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

export async function mockGatewayApis(page: Page): Promise<void> {
  const state = createMockState();

  await page.route(CHAT_GATEWAY_MATCH, async (route) => {
    if (route.request().method() !== 'POST') {
      await fulfillJson(route, 405, { error: 'Method not allowed' });
      return;
    }

    const payload = parseRequestBody(route);
    if (!payload) {
      await fulfillJson(route, 400, { error: 'Invalid JSON payload' });
      return;
    }

    const rpc = getRpcName(route);

    if (rpc === 'GetChats') {
      const conversations = Array.from(state.conversationStore.values())
        .map((conversation) => buildConversationResponse(conversation, state.unreadIdsByConversation))
        .sort((a, b) => {
          const aTime = Date.parse(a.updatedAt);
          const bTime = Date.parse(b.updatedAt);
          return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
        });
      await fulfillJson(route, 200, { conversations });
      return;
    }

    if (rpc === 'GetMessages') {
      const conversationId = parseConversationId(payload);
      if (!conversationId || !state.conversationStore.has(conversationId)) {
        await fulfillJson(route, 404, { error: 'conversation not found' });
        return;
      }
      const messages = state.messagesByConversation.get(conversationId) ?? [];
      const unreadCount = state.unreadIdsByConversation.get(conversationId)?.size ?? 0;
      await fulfillJson(route, 200, {
        messages: messages.map((message) => ({ ...message, fileIds: [...message.fileIds] })),
        unreadCount,
      });
      return;
    }

    if (rpc === 'SendMessage') {
      const conversationId = parseConversationId(payload);
      if (!conversationId || !state.conversationStore.has(conversationId)) {
        await fulfillJson(route, 404, { error: 'conversation not found' });
        return;
      }
      const senderId = typeof payload.senderId === 'string' && payload.senderId.trim()
        ? payload.senderId
        : state.currentUserId;
      const body = typeof payload.body === 'string' ? payload.body : '';
      const fileIds = Array.isArray(payload.fileIds)
        ? payload.fileIds.filter((id): id is string => typeof id === 'string')
        : [];
      const message: ConversationMessageRecord = {
        id: randomUUID(),
        conversationId,
        senderId,
        body,
        fileIds,
        createdAt: new Date().toISOString(),
      };
      const messages = state.messagesByConversation.get(conversationId) ?? [];
      messages.push(message);
      state.messagesByConversation.set(conversationId, messages);

      const conversation = state.conversationStore.get(conversationId);
      if (conversation) {
        state.conversationStore.set(conversationId, {
          ...conversation,
          updatedAt: message.createdAt,
          summary: summarize(message.body),
        });
      }
      await fulfillJson(route, 200, { message });
      return;
    }

    if (rpc === 'CreateChat') {
      const participantIds = Array.isArray(payload.participantIds)
        ? payload.participantIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : [];
      const createdAt = new Date().toISOString();
      const participantSet = new Set([state.currentUserId, ...participantIds]);
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
      state.conversationStore.set(conversation.id, conversation);
      state.messagesByConversation.set(conversation.id, []);
      state.unreadIdsByConversation.set(conversation.id, new Set());
      await fulfillJson(route, 200, {
        conversation: buildConversationResponse(conversation, state.unreadIdsByConversation),
      });
      return;
    }

    if (rpc === 'MarkAsRead') {
      const conversationId = parseConversationId(payload);
      if (!conversationId || !state.conversationStore.has(conversationId)) {
        await fulfillJson(route, 404, { error: 'conversation not found' });
        return;
      }
      const messageIds = Array.isArray(payload.messageIds)
        ? payload.messageIds.filter((id): id is string => typeof id === 'string')
        : [];
      const unreadIds = new Set(state.unreadIdsByConversation.get(conversationId) ?? []);
      let readCount = 0;
      messageIds.forEach((id) => {
        if (unreadIds.delete(id)) readCount += 1;
      });
      state.unreadIdsByConversation.set(conversationId, unreadIds);
      await fulfillJson(route, 200, { readCount });
      return;
    }

    if (rpc === 'UpdateChatStatus') {
      const conversationId = parseConversationId(payload);
      if (!conversationId || !state.conversationStore.has(conversationId)) {
        await fulfillJson(route, 404, { error: 'conversation not found' });
        return;
      }
      if (payload.status !== 'open' && payload.status !== 'closed') {
        await fulfillJson(route, 400, { error: 'invalid conversation status' });
        return;
      }
      const conversation = state.conversationStore.get(conversationId);
      if (!conversation) {
        await fulfillJson(route, 404, { error: 'conversation not found' });
        return;
      }
      const updatedConversation: ConversationSummary = {
        ...conversation,
        status: payload.status,
        updatedAt: new Date().toISOString(),
      };
      state.conversationStore.set(conversationId, updatedConversation);
      await fulfillJson(route, 200, {
        conversation: buildConversationResponse(updatedConversation, state.unreadIdsByConversation),
      });
      return;
    }

    await fulfillJson(route, 404, { error: 'unknown method' });
  });

  await page.route(AGENTS_GATEWAY_MATCH, async (route) => {
    if (route.request().method() !== 'POST') {
      await fulfillJson(route, 405, { error: 'Method not allowed' });
      return;
    }
    const payload = parseRequestBody(route);
    if (!payload) {
      await fulfillJson(route, 400, { error: 'Invalid JSON payload' });
      return;
    }
    const rpc = getRpcName(route);
    if (rpc !== 'ListAgents') {
      await fulfillJson(route, 404, { error: 'unknown method' });
      return;
    }
    const agents: AgentSummary[] = mockAgents.map((agent) => ({ ...agent }));
    await fulfillJson(route, 200, { agents });
  });
}
