import { it, expect } from 'vitest';
import { suggestionOrder } from '../lib/order';
import { TYPES } from '../lib/study';
it('samples the valid order space with every cell once and no adjacent matched pair', () => {
  let count = 0;
  suggestionOrder((max) => {
    count = max;
    return 0;
  });
  const seen = new Set<string>();
  for (let n = 0; n < count; n++) {
    const order = suggestionOrder(() => n);
    expect([...order].sort()).toEqual([...TYPES].sort());
    seen.add(order.join(','));
    for (let i = 1; i < order.length; i++)
      expect(order[i].replace(/_(direct|permissive)$/, '')).not.toBe(
        order[i - 1].replace(/_(direct|permissive)$/, ''),
      );
  }
  expect(count).toBeGreaterThan(100);
  expect(seen.size).toBe(count);
});
