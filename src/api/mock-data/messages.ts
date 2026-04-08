import { chatOneId, chatThreeId, chatTwoId } from './chats';

export const queuedMessagesByChat = new Map<string, Array<{ id: string; text: string; enqueuedAt?: string }>>([
  [chatOneId, []],
  [chatTwoId, []],
  [chatThreeId, []],
]);
