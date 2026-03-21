import { test as base, expect } from './fixtures';
import { mockChatApi } from './chat-helpers';

export { expect };

export const test = base.extend({
  page: async ({ page }, use) => {
    await mockChatApi(page);
    await use(page);
  },
});
