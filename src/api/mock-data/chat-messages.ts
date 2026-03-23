import type { ChatMessage } from '../types/chat';
import { stubUsers } from '../../data/stub-users';
import { agentAccountId, agentCampaignId, agentResearchId } from './agents';
import { chatOneId, chatThreeId, chatTwoId } from './chats';
import { iso } from './time';

type ChatMessageSeed = {
  chatId: string;
  messages: ChatMessage[];
};

const [casey, alex, jamie] = stubUsers;

const chatMessageSeeds: ChatMessageSeed[] = [
  {
    chatId: chatOneId,
    messages: [
      {
        id: 'conv-1-msg-1',
        chatId: chatOneId,
        senderId: casey.id,
        body: 'Draft a Q2 marketing brief focused on the new launch.',
        fileIds: [],
        createdAt: iso(-159),
      },
      {
        id: 'conv-1-msg-2',
        chatId: chatOneId,
        senderId: agentCampaignId,
        body: 'Here is a draft brief with positioning, goals, and launch phases.',
        fileIds: [],
        createdAt: iso(-158),
      },
      {
        id: 'conv-1-msg-3',
        chatId: chatOneId,
        senderId: casey.id,
        body: 'Add a section on creative deliverables and internal review dates.',
        fileIds: [],
        createdAt: iso(-19),
      },
      {
        id: 'conv-1-msg-4',
        chatId: chatOneId,
        senderId: agentCampaignId,
        body: 'Updated draft includes a deliverables checklist and review cadence.',
        fileIds: ['file-brief-1'],
        createdAt: iso(-18),
      },
    ],
  },
  {
    chatId: chatTwoId,
    messages: [
      {
        id: 'conv-2-msg-1',
        chatId: chatTwoId,
        senderId: alex.id,
        body: 'Draft a follow-up note for the ACME renewal.',
        fileIds: [],
        createdAt: iso(-379),
      },
      {
        id: 'conv-2-msg-2',
        chatId: chatTwoId,
        senderId: agentAccountId,
        body: 'Drafted a friendly renewal follow-up highlighting next steps.',
        fileIds: [],
        createdAt: iso(-378),
      },
      {
        id: 'conv-2-msg-3',
        chatId: chatTwoId,
        senderId: alex.id,
        body: 'Please include pricing highlights and the renewal deadline.',
        fileIds: ['file-acme-1'],
        createdAt: iso(-310),
      },
      {
        id: 'conv-2-msg-4',
        chatId: chatTwoId,
        senderId: agentAccountId,
        body: 'Added pricing details, renewal timeline, and next-step CTA.',
        fileIds: [],
        createdAt: iso(-300),
      },
    ],
  },
  {
    chatId: chatThreeId,
    messages: [
      {
        id: 'conv-3-msg-1',
        chatId: chatThreeId,
        senderId: jamie.id,
        body: 'Review edits and finalize the Q2 campaign outline.',
        fileIds: [],
        createdAt: iso(-88),
      },
      {
        id: 'conv-3-msg-2',
        chatId: chatThreeId,
        senderId: agentResearchId,
        body: 'Summarized competitive insights and top three growth channels.',
        fileIds: [],
        createdAt: iso(-80),
      },
      {
        id: 'conv-3-msg-3',
        chatId: chatThreeId,
        senderId: jamie.id,
        body: 'Can you add a short section on regional rollout considerations?',
        fileIds: [],
        createdAt: iso(-60),
      },
      {
        id: 'conv-3-msg-4',
        chatId: chatThreeId,
        senderId: agentResearchId,
        body: 'Added rollout considerations for NA, EMEA, and APAC regions.',
        fileIds: [],
        createdAt: iso(-45),
      },
    ],
  },
];

const unreadMessageIdSeeds: Array<[string, string[]]> = [
  [chatOneId, ['conv-1-msg-4']],
  [chatTwoId, ['conv-2-msg-3', 'conv-2-msg-4']],
  [chatThreeId, ['conv-3-msg-4']],
];

export function createChatMessagesMap(): Map<string, ChatMessage[]> {
  return new Map(
    chatMessageSeeds.map((seed) => [
      seed.chatId,
      seed.messages.map((message) => ({ ...message, fileIds: [...message.fileIds] })),
    ]),
  );
}

export function createUnreadIdsByChatMap(): Map<string, Set<string>> {
  return new Map(
    unreadMessageIdSeeds.map(([chatId, messageIds]) => [chatId, new Set(messageIds)]),
  );
}
