import { describe, expect, it } from 'vitest';
import { createDraftId, isDraftThreadId } from './draftUtils';

describe('draftUtils', () => {
  it('detects draft ids', () => {
    expect(isDraftThreadId('draft:123')).toBe(true);
    expect(isDraftThreadId('thread:123')).toBe(false);
    expect(isDraftThreadId(null)).toBe(false);
    expect(isDraftThreadId(undefined)).toBe(false);
  });

  it('creates draft ids with prefix', () => {
    const id = createDraftId();
    expect(id.startsWith('draft:')).toBe(true);
  });
});
