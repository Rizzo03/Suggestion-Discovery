import { it, expect } from 'vitest';
import { bodyContextSchema, feelingsSchema, spokenLocation } from '../lib/body-context';
import { baselineSchema } from '../lib/study';
import { prompt } from '../lib/ai';
it('requires a predefined body area and validates non-diagnostic feelings responses', () => {
  expect(bodyContextSchema.safeParse({ primaryLocation: 'Lower back' }).success).toBe(false);
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
    ['Not aware of feelings', 'Worry'],
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
  expect(text).toContain('No metaphors, similes, symbolic substitutions');
  expect(text).toContain('literal physical qualities');
  expect(text).toContain('literal emotional or motivational response');
  const undisclosed = prompt(['Physical pain'], {
    primaryLocation: 'Lower back',
    associatedFeelings: ['Prefer not to say'],
  });
  expect(undisclosed).toContain('none disclosed; do not infer distress');
  expect(undisclosed).not.toContain('Prefer not to say');
  expect(spokenLocation('Several body areas')).toBe('selected body areas');
});

it('requires duration and a feelings response at session creation, with non-disclosure alternatives', () => {
  const baseline = {
    experiences: ['Physical pain'],
    ratings: { 'Physical pain': 5 },
    consent: true,
    adult: true,
    physicalEligibility: true,
    associatedSensations: ['Aching'],
    primaryLocation: 'Lower back',
    symptomDuration: 'Less than 3 months',
    associatedFeelings: ['Not aware of feelings'],
  };
  expect(baselineSchema.safeParse(baseline).success).toBe(true);
  for (const values of [[], undefined])
    expect(baselineSchema.safeParse({ ...baseline, associatedFeelings: values }).success).toBe(
      false,
    );
  for (const value of ['', undefined, 'unknown'])
    expect(baselineSchema.safeParse({ ...baseline, symptomDuration: value }).success).toBe(false);
  expect(
    baselineSchema.safeParse({
      ...baseline,
      symptomDuration: '3 months or longer',
      associatedFeelings: ['Prefer not to say'],
    }).success,
  ).toBe(true);
  expect(
    prompt(['Physical pain'], {
      primaryLocation: 'Lower back',
      associatedFeelings: ['Not aware of feelings'],
      symptomDuration: 'Less than 3 months',
    }),
  ).toContain('none disclosed; do not infer distress');
});
