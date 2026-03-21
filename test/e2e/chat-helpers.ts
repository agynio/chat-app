import type { Page, Route } from '@playwright/test';
import type { Chat, ChatMessage, GetMessagesRequest, MarkAsReadRequest, SendMessageRequest } from '../../src/api/types/chat';
import { expect } from './fixtures';

const DEFAULT_USER_ID = process.env.E2E_OIDC_EMAIL?.trim() || 'e2e-tester@agyn.test';

export type ChatMockData = {
  currentUserId: string;
  chats: Chat[];
  messagesByChatId: Record<string, ChatMessage[]>;
  unreadCountByChatId: Record<string, number>;
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export function createChatMockData(currentUserId = DEFAULT_USER_ID): ChatMockData {
  const chatOne: Chat = {
    id: 'chat-1',
    participants: [
      { id: currentUserId, joinedAt: minutesAgo(240) },
      { id: 'alex@agyn.test', joinedAt: minutesAgo(238) },
    ],
    createdAt: minutesAgo(240),
    updatedAt: minutesAgo(5),
  };

  const chatTwo: Chat = {
    id: 'chat-2',
    participants: [
      { id: currentUserId, joinedAt: minutesAgo(420) },
      { id: 'sam@agyn.test', joinedAt: minutesAgo(418) },
      { id: 'taylor@agyn.test', joinedAt: minutesAgo(417) },
    ],
    createdAt: minutesAgo(420),
    updatedAt: minutesAgo(32),
  };

  const chatThree: Chat = {
    id: 'chat-3',
    participants: [
      { id: currentUserId, joinedAt: minutesAgo(620) },
      { id: 'jordan@agyn.test', joinedAt: minutesAgo(619) },
    ],
    createdAt: minutesAgo(620),
    updatedAt: minutesAgo(58),
  };

  const messagesByChatId: Record<string, ChatMessage[]> = {
    [chatOne.id]: [
      {
        id: 'chat-1-message-1',
        chatId: chatOne.id,
        senderId: 'alex@agyn.test',
        body: 'Hey, are we still on for the demo?',
        fileIds: [],
        createdAt: minutesAgo(4),
      },
      {
        id: 'chat-1-message-2',
        chatId: chatOne.id,
        senderId: currentUserId,
        body: 'Yep, see you at 2 PM.',
        fileIds: [],
        createdAt: minutesAgo(3),
      },
    ],
    [chatTwo.id]: [
      {
        id: 'chat-2-message-1',
        chatId: chatTwo.id,
        senderId: 'sam@agyn.test',
        body: 'Draft timeline looks good to me.',
        fileIds: [],
        createdAt: minutesAgo(26),
      },
    ],
    [chatThree.id]: [],
  };

  const unreadCountByChatId: Record<string, number> = {
    [chatOne.id]: 1,
  };

  return {
    currentUserId,
    chats: [chatOne, chatTwo, chatThree],
    messagesByChatId,
    unreadCountByChatId,
  };
}

export function createEmptyChatMockData(currentUserId = DEFAULT_USER_ID): ChatMockData {
  return {
    currentUserId,
    chats: [],
    messagesByChatId: {},
    unreadCountByChatId: {},
  };
}

export function getChatTitle(chat: Chat, currentUserId: string) {
  const otherParticipants = chat.participants
    .map((participant) => participant.id)
    .filter((id) => (currentUserId ? id !== currentUserId : true));
  return otherParticipants.length > 0 ? otherParticipants.join(', ') : 'Just you';
}

export function getParticipantLabel(chat: Chat) {
  const count = chat.participants.length;
  return `${count} participant${count === 1 ? '' : 's'}`;
}

function parseRequest<T>(route: Route): T {
  const payload = route.request().postDataJSON();
  if (!payload || typeof payload !== 'object') {
    throw new Error('Chat mock request body is missing');
  }
  return payload as T;
}

function requireChatId(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Chat mock request missing chatId');
  }
  return value;
}

export async function mockChatApi(page: Page, data: ChatMockData) {
  await page.route(/agynio\.api\.gateway\.v1\.ChatGateway/, async (route) => {
    const url = route.request().url();

    if (url.includes('GetChats')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ chats: data.chats }),
      });
      return;
    }

    if (url.includes('GetMessages')) {
      const payload = parseRequest<GetMessagesRequest>(route);
      const chatId = requireChatId(payload.chatId);
      const messages = data.messagesByChatId[chatId] ?? [];
      const unreadCount = data.unreadCountByChatId[chatId];
      const response: { messages: ChatMessage[]; unreadCount?: number } = { messages };
      if (typeof unreadCount === 'number') {
        response.unreadCount = unreadCount;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
      return;
    }

    if (url.includes('SendMessage')) {
      const payload = parseRequest<SendMessageRequest>(route);
      const chatId = requireChatId(payload.chatId);
      const message: ChatMessage = {
        id: `chat-${chatId}-message-${Date.now()}`,
        chatId,
        senderId: data.currentUserId,
        body: payload.body ?? '',
        fileIds: payload.fileIds ?? [],
        createdAt: new Date().toISOString(),
      };

      const existing = data.messagesByChatId[chatId] ?? [];
      data.messagesByChatId[chatId] = [...existing, message];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message }),
      });
      return;
    }

    if (url.includes('MarkAsRead')) {
      const payload = parseRequest<MarkAsReadRequest>(route);
      const messageIds = Array.isArray(payload.messageIds) ? payload.messageIds : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ readCount: messageIds.length }),
      });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unhandled ChatGateway request' }),
    });
  });
}

export async function waitForChatListState(page: Page) {
  const list = page.getByTestId('chat-list');
  const emptyState = page.getByTestId('chat-list-empty');

  await expect
    .poll(async () => {
      if (await list.isVisible()) return 'list';
      if (await emptyState.isVisible()) return 'empty';
      return 'loading';
    }, { timeout: 15000 })
    .not.toBe('loading');

  const count = await page.getByTestId('chat-list-item').count();
  return { list, emptyState, count };
}

export async function openChatFromList(page: Page, chat: Chat, currentUserId: string) {
  await page.goto('/agents/chat');
  const { list } = await waitForChatListState(page);
  await expect(list).toBeVisible();

  const title = getChatTitle(chat, currentUserId);
  const chatItem = page.getByTestId('chat-list-item').filter({ hasText: title }).first();
  await expect(chatItem).toBeVisible();
  await chatItem.click();
  await expect(page).toHaveURL(new RegExp(`/agents/chat/${chat.id}$`));
  return chatItem;
}
