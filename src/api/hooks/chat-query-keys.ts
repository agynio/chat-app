export const CHAT_MESSAGES_PAGE_SIZE = 30;

export const chatMessagesQueryKey = (chatId: string) => [
  'chats',
  chatId,
  'messages',
  CHAT_MESSAGES_PAGE_SIZE,
] as const;

export type ChatMessagesQueryKey = ReturnType<typeof chatMessagesQueryKey>;
