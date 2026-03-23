import { getUuid } from '@/utils/getUuid';

export function isDraftConversationId(conversationId: string | null | undefined): conversationId is string {
  return typeof conversationId === 'string' && conversationId.startsWith('draft:');
}

export function createDraftId(): string {
  return `draft:${getUuid()}`;
}
