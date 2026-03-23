import type { ChatMessage } from '../types/chat';
import { stubUsers } from '../../data/stub-users';
import { agentAccountId, agentCampaignId, agentResearchId } from './agents';
import { conversationOneId, conversationThreeId, conversationTwoId } from './conversations';
import { iso } from './time';

type ConversationMessageSeed = {
  conversationId: string;
  messages: ChatMessage[];
};

const [casey, alex, jamie] = stubUsers;

const conversationMessageSeeds: ConversationMessageSeed[] = [
  {
    conversationId: conversationOneId,
    messages: [
      {
        id: 'conv-1-msg-1',
        chatId: conversationOneId,
        senderId: casey.id,
        body: 'Draft a Q2 marketing brief focused on the new launch.',
        fileIds: [],
        createdAt: iso(-159),
      },
      {
        id: 'conv-1-msg-2',
        chatId: conversationOneId,
        senderId: agentCampaignId,
        body: 'Here is a draft brief with positioning, goals, and launch phases.',
        fileIds: [],
        createdAt: iso(-158),
      },
      {
        id: 'conv-1-msg-3',
        chatId: conversationOneId,
        senderId: casey.id,
        body: 'Add a section on creative deliverables and internal review dates.',
        fileIds: [],
        createdAt: iso(-19),
      },
      {
        id: 'conv-1-msg-4',
        chatId: conversationOneId,
        senderId: agentCampaignId,
        body: 'Updated draft includes a deliverables checklist and review cadence.',
        fileIds: ['file-brief-1'],
        createdAt: iso(-18),
      },
    ],
  },
  {
    conversationId: conversationTwoId,
    messages: [
      {
        id: 'conv-2-msg-1',
        chatId: conversationTwoId,
        senderId: alex.id,
        body: 'Draft a follow-up note for the ACME renewal.',
        fileIds: [],
        createdAt: iso(-379),
      },
      {
        id: 'conv-2-msg-2',
        chatId: conversationTwoId,
        senderId: agentAccountId,
        body: 'Drafted a friendly renewal follow-up highlighting next steps.',
        fileIds: [],
        createdAt: iso(-378),
      },
      {
        id: 'conv-2-msg-3',
        chatId: conversationTwoId,
        senderId: alex.id,
        body: 'Please include pricing highlights and the renewal deadline.',
        fileIds: ['file-acme-1'],
        createdAt: iso(-310),
      },
      {
        id: 'conv-2-msg-4',
        chatId: conversationTwoId,
        senderId: agentAccountId,
        body: 'Added pricing details, renewal timeline, and next-step CTA.',
        fileIds: [],
        createdAt: iso(-300),
      },
    ],
  },
  {
    conversationId: conversationThreeId,
    messages: [
      {
        id: 'conv-3-msg-1',
        chatId: conversationThreeId,
        senderId: jamie.id,
        body: 'Review edits and finalize the Q2 campaign outline.',
        fileIds: [],
        createdAt: iso(-88),
      },
      {
        id: 'conv-3-msg-2',
        chatId: conversationThreeId,
        senderId: agentResearchId,
        body: 'Summarized competitive insights and top three growth channels.',
        fileIds: [],
        createdAt: iso(-80),
      },
      {
        id: 'conv-3-msg-3',
        chatId: conversationThreeId,
        senderId: jamie.id,
        body: 'Can you add a short section on regional rollout considerations?',
        fileIds: [],
        createdAt: iso(-60),
      },
      {
        id: 'conv-3-msg-4',
        chatId: conversationThreeId,
        senderId: agentResearchId,
        body: 'Added rollout considerations for NA, EMEA, and APAC regions.',
        fileIds: [],
        createdAt: iso(-45),
      },
    ],
  },
];

const unreadMessageIdSeeds: Array<[string, string[]]> = [
  [conversationOneId, ['conv-1-msg-4']],
  [conversationTwoId, ['conv-2-msg-3', 'conv-2-msg-4']],
  [conversationThreeId, ['conv-3-msg-4']],
];

export function createConversationMessagesMap(): Map<string, ChatMessage[]> {
  return new Map(
    conversationMessageSeeds.map((seed) => [
      seed.conversationId,
      seed.messages.map((message) => ({ ...message, fileIds: [...message.fileIds] })),
    ]),
  );
}

export function createUnreadIdsByConversationMap(): Map<string, Set<string>> {
  return new Map(
    unreadMessageIdSeeds.map(([conversationId, messageIds]) => [conversationId, new Set(messageIds)]),
  );
}
