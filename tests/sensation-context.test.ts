import { expect, it } from 'vitest';
import { sensationsSchema } from '../lib/body-context';
import { baselineSchema } from '../lib/study';
import { prompt } from '../lib/ai';
import { sessionRows } from '../lib/export';
import { fixture } from './fixtures';
it('requires controlled sensation responses and keeps exclusive alternatives separate', () => {
  const baseline = {
    experiences: ['Physical pain'],
    ratings: { 'Physical pain': 5 },
    consent: true,
    adult: true,
    physicalEligibility: true,
    primaryLocation: 'Abdomen',
    symptomDuration: 'Less than 3 months',
    associatedFeelings: ['Not aware of feelings'],
    associatedSensations: ['Aching', 'Cramping'],
  };
  expect(baselineSchema.safeParse(baseline).success).toBe(true);
  for (const value of [
    undefined,
    [],
    ['my personal address'],
    ['Aching', 'Aching'],
    ['Hard to describe', 'Burning'],
    ['Prefer not to say', 'Tightness'],
    ['Hard to describe', 'Prefer not to say'],
  ])
    expect(baselineSchema.safeParse({ ...baseline, associatedSensations: value }).success).toBe(
      false,
    );
  for (const value of [
    ['Hard to describe'],
    ['Prefer not to say'],
    ['Another sensation', 'Aching'],
  ])
    expect(sensationsSchema.safeParse(value).success).toBe(true);
});
it('personalises sensory generation without diagnosing or inventing undisclosed qualities', () => {
  const context = {
    primaryLocation: 'Abdomen' as const,
    associatedFeelings: [],
    associatedSensations: ['Aching' as const, 'Cramping' as const],
  };
  expect(prompt(['Physical pain'], context)).toContain(
    'Sensation qualities selected at session start: Aching, Cramping',
  );
  expect(prompt(['Physical pain'], context)).toContain('Do not treat descriptors as diagnoses');
  for (const value of [
    undefined,
    ['Hard to describe'] as const,
    ['Prefer not to say'] as const,
    ['Another sensation'] as const,
  ]) {
    const text = prompt(['Physical pain'], {
      ...context,
      associatedSensations: value ? [...value] : undefined,
    });
    expect(text).toContain('none disclosed; do not invent specific sensory qualities');
  }
});
it('exports the selected sensation qualities and preserves absence in older records', () => {
  const state = fixture();
  const session = {
    id: 's',
    participant_id: 'p',
    version: 1,
    created_at: '2026-11-16T00:00:00Z',
    state,
  };
  expect(sessionRows([session])[0].associated_sensations).toEqual(['Aching', 'Tightness']);
  delete state.associatedSensations;
  expect(sessionRows([session])[0].associated_sensations).toBeUndefined();
  expect(state.associatedSensations).toBeUndefined();
});
