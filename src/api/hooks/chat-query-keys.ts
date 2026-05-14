export const CHAT_MESSAGES_PAGE_SIZE = 30;
export const CHAT_MESSAGES_ORDER = 'MESSAGE_ORDER_NEWEST_FIRST' as const;

export const chatMessagesQueryKey = (chatId: string) => [
  'chats',
  chatId,
  'messages',
  CHAT_MESSAGES_PAGE_SIZE,
  CHAT_MESSAGES_ORDER,
] as const;

export type ChatMessagesQueryKey = ReturnType<typeof chatMessagesQueryKey>;
