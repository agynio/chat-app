import { describe, expect, it } from 'vitest';
import { isThreadDegradedError } from './errors';

const buildError = (data: unknown) => ({ response: { data } });

describe('isThreadDegradedError', () => {
  it('matches failed precondition with exact message', () => {
    const error = buildError({ code: 'failed_precondition', message: 'thread is degraded' });
    expect(isThreadDegradedError(error)).toBe(true);
  });

  it('prefers top-level fields over nested error payload', () => {
    const error = buildError({
      code: 'failed_precondition',
      message: 'thread is degraded',
      error: { code: 'permission_denied', message: 'not degraded' },
    });
    expect(isThreadDegradedError(error)).toBe(true);
  });

  it('falls back to nested error payload', () => {
    const error = buildError({ error: { code: 'failed_precondition', message: 'thread is degraded' } });
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
