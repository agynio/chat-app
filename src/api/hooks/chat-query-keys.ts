const MESSAGE_PAGE_SIZE = 30;

export const chatMessagesQueryKey = (chatId: string) => ['chats', chatId, 'messages', MESSAGE_PAGE_SIZE] as const;

export type ChatMessagesQueryKey = ReturnType<typeof chatMessagesQueryKey>;

export const chatMessagesPageSize = (queryKey: ChatMessagesQueryKey): number => queryKey[3];
