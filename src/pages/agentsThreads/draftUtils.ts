import { getUuid } from '@/utils/getUuid';

export function isDraftThreadId(threadId: string | null | undefined): threadId is string {
  return typeof threadId === 'string' && threadId.startsWith('draft:');
}

export function createDraftId(): string {
  return `draft:${getUuid()}`;
}
