import { test as base, expect } from './fixtures';
import type { ChatMockData } from './chat-helpers';
import { createChatMockData, createEmptyChatMockData, mockChatApi } from './chat-helpers';

export { expect };

type ChatFixtures = {
  chatSeed: ChatMockData;
};

export const test = base.extend<ChatFixtures>({
  chatSeed: async ({}, use) => {
    await use(createChatMockData());
  },
  page: async ({ page, chatSeed }, use) => {
    await mockChatApi(page, chatSeed);
    await use(page);
  },
});

export const emptyTest = base.extend<ChatFixtures>({
  chatSeed: async ({}, use) => {
    await use(createEmptyChatMockData());
  },
  page: async ({ page, chatSeed }, use) => {
    await mockChatApi(page, chatSeed);
    await use(page);
  },
});
