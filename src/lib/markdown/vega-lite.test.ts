import { describe, expect, it } from 'vitest';
import { validateVegaLiteSpec } from './vega-lite';

describe('validateVegaLiteSpec', () => {
  it('rejects incomplete vega-lite specs before rendering', () => {
    expect(validateVegaLiteSpec('{"data":{"values":[{"x":1,"y":2}]},"mark":"bar"}')).toEqual({
      error: 'Vega-Lite spec must include data, mark, and encoding.',
    });
  });

  it('accepts complete inline vega-lite specs', () => {
    expect(
      validateVegaLiteSpec(
        '{"data":{"values":[{"x":1,"y":2}]},"mark":"bar","encoding":{"x":{"field":"x"}}}',
      ).error,
    ).toBeUndefined();
  });
});
