import { describe, expect, it } from 'vitest';
import { createDraftId, isDraftChatId } from './draftUtils';

describe('draftUtils', () => {
  it('detects draft ids', () => {
    expect(isDraftChatId('draft:123')).toBe(true);
    expect(isDraftChatId('chat:123')).toBe(false);
    expect(isDraftChatId(null)).toBe(false);
    expect(isDraftChatId(undefined)).toBe(false);
  });

  it('creates draft ids with prefix', () => {
    const id = createDraftId();
    expect(id.startsWith('draft:')).toBe(true);
  });
});
