import { describe, expect, it } from 'vitest';
import { shouldFetchNextMessagesPage } from './messagePagination';

describe('shouldFetchNextMessagesPage', () => {
  it('fetches when the cached page does not fill the message container', () => {
    expect(shouldFetchNextMessagesPage({ scrollHeight: 400, clientHeight: 600 })).toBe(true);
    expect(shouldFetchNextMessagesPage({ scrollHeight: 600, clientHeight: 600 })).toBe(true);
  });

  it('waits for scroll when the cached page overflows the message container', () => {
    expect(shouldFetchNextMessagesPage({ scrollHeight: 601, clientHeight: 600 })).toBe(false);
  });
});
