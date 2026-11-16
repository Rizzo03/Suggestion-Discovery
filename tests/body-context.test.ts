import { it, expect } from 'vitest';
import { bodyContextSchema, feelingsSchema, spokenLocation } from '../lib/body-context';
import { prompt } from '../lib/ai';
it('requires a predefined body area and accepts optional non-diagnostic feelings', () => {
  expect(bodyContextSchema.parse({ primaryLocation: 'Lower back' }).associatedFeelings).toEqual([]);
  expect(bodyContextSchema.safeParse({ associatedFeelings: [] }).success).toBe(false);
  expect(bodyContextSchema.safeParse({ primaryLocation: 'my full address' }).success).toBe(false);
  expect(
    bodyContextSchema.safeParse({
      primaryLocation: 'Neck',
      associatedFeelings: ['Worry', 'Frustration'],
    }).success,
  ).toBe(true);
  for (const feelings of [
    ['None of these', 'Worry'],
    ['Prefer not to say', 'Calm'],
    ['Worry', 'Worry'],
    ['Unknown feeling'],
  ])
    expect(feelingsSchema.safeParse(feelings).success).toBe(false);
  expect(feelingsSchema.safeParse(['Prefer not to say']).success).toBe(true);
});
it('personalises the prompt from controlled context without inferring undisclosed feelings', () => {
  const text = prompt(['Physical pain'], {
    primaryLocation: 'Shoulder',
    associatedFeelings: ['Worry', 'Frustration'],
  });
  expect(text).toContain('Your shoulder');
  expect(text).toContain('Imagine your shoulder');
  expect(text).toContain('Worry, Frustration');
  expect(text).toContain('SENSORY_DISCRIMINATIVE');
  expect(text).toContain('AFFECTIVE_MOTIVATIONAL');
  const undisclosed = prompt(['Physical pain'], {
    primaryLocation: 'Lower back',
    associatedFeelings: ['Prefer not to say'],
  });
  expect(undisclosed).toContain('none disclosed; do not infer distress');
  expect(undisclosed).not.toContain('Prefer not to say');
  expect(spokenLocation('Several body areas')).toBe('selected body areas');
});
