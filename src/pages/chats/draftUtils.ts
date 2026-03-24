import { getUuid } from '@/utils/getUuid';

export function isDraftChatId(chatId: string | null | undefined): chatId is string {
  return typeof chatId === 'string' && chatId.startsWith('draft:');
}

export function createDraftId(): string {
  return `draft:${getUuid()}`;
}
