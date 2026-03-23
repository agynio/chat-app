import { describe, expect, it } from 'vitest';
import { createDraftId, isDraftConversationId } from './draftUtils';

describe('draftUtils', () => {
  it('detects draft ids', () => {
    expect(isDraftConversationId('draft:123')).toBe(true);
    expect(isDraftConversationId('conversation:123')).toBe(false);
    expect(isDraftConversationId(null)).toBe(false);
    expect(isDraftConversationId(undefined)).toBe(false);
  });

  it('creates draft ids with prefix', () => {
    const id = createDraftId();
    expect(id.startsWith('draft:')).toBe(true);
  });
});
