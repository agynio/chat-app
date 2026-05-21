import { describe, expect, it } from 'vitest';
import { extractRunIdFromListSpans } from './tracing-core';

describe('extractRunIdFromListSpans', () => {
  it('extracts trace id bytes from camelCase resource spans', () => {
    const runId = extractRunIdFromListSpans({
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                { traceId: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) },
              ],
            },
          ],
        },
      ],
    });

    expect(runId).toBe('000102030405060708090a0b0c0d0e0f');
  });

  it('extracts string trace ids from snake_case resource spans', () => {
    const runId = extractRunIdFromListSpans({
      resource_spans: [
        {
          scope_spans: [
            {
              spans: [{ trace_id: '0x00112233445566778899aabbccddeeff' }],
            },
          ],
        },
      ],
    });

    expect(runId).toBe('00112233445566778899aabbccddeeff');
  });

  it('returns null when no valid trace id exists', () => {
    expect(extractRunIdFromListSpans({ resourceSpans: [{ scopeSpans: [{ spans: [{ traceId: 'bad' }] }] }] })).toBeNull();
  });
});
