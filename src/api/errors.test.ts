import { describe, expect, it } from 'vitest';
import { isThreadDegradedError } from './errors';

const buildError = (data: unknown) => ({ response: { data } });

describe('isThreadDegradedError', () => {
  it('matches failed precondition with exact message', () => {
    const error = buildError({ code: 'failed_precondition', message: 'thread is degraded' });
    expect(isThreadDegradedError(error)).toBe(true);
  });

  it('normalizes camel case codes', () => {
    const error = buildError({ code: 'FailedPrecondition', message: 'thread is degraded' });
    expect(isThreadDegradedError(error)).toBe(true);
  });

  it('rejects non-matching messages', () => {
    const error = buildError({ code: 'failed_precondition', message: 'Thread is degraded' });
    expect(isThreadDegradedError(error)).toBe(false);
  });

  it('parses JSON payloads', () => {
    const error = buildError(JSON.stringify({ code: 'failed_precondition', message: 'thread is degraded' }));
    expect(isThreadDegradedError(error)).toBe(true);
  });
});
