import { describe, it, expect } from 'vitest';
import { randomInt } from 'node:crypto';
import {
  baselineSchema,
  canGenerate,
  currentSuggestion,
  exactRatings,
  eyeFor,
  generatedSchema,
  needsReassessment,
  reassess,
  respond,
  shuffle,
  Study,
  TYPES,
  csv,
} from '../lib/study';
const at = '2026-11-15T10:00:00.000Z';
import { fixture } from './fixtures';

function round(s: Study): Study {
  canGenerate(s);
  const n = s.rounds.length + 1;
  return {
    ...s,
    rounds: [
      ...s.rounds,
      {
        id: `r${n}`,
        number: n,
        eye: eyeFor(s.firstEye, n),
        order: [...TYPES],
        randomisation: { algorithm: 'test', at },
        model: 'test',
        promptVersion: 'test',
        prompt: 'test',
        responseId: 'test',
        createdAt: at,
        suggestions: TYPES.map((type, i) => ({
          id: `${n}-${i}`,
          type,
          position: i + 1,
          text: 'test',
        })),
      },
    ],
  };
}
describe('study protocol', () => {
  it('alternates eye allocation over arbitrary rounds', () => {
    for (const first of ['open', 'closed'] as const)
      for (let n = 1; n < 1000; n++) {
        expect(eyeFor(first, n)).toBe(n % 2 ? first : first === 'open' ? 'closed' : 'open');
      }
  });
  it('makes independent valid permutations and supports both extremes of shuffle', () => {
    const orders = new Set<string>();
    for (let n = 0; n < 100; n++) {
      const result = shuffle(TYPES, randomInt);
      expect(new Set(result)).toEqual(new Set(TYPES));
      orders.add(result.join(','));
    }
    expect(orders.size).toBeGreaterThan(10);
    expect(shuffle(TYPES, (max) => max - 1)).toEqual(TYPES);
    expect(shuffle(TYPES, () => 0)).not.toEqual(TYPES);
  });
  it('requires listening and a 0–10 or unable response before progression', () => {
    let s = round(fixture());
    const x = currentSuggestion(s)!;
    expect(() => respond(s, x.id, 0, at)).toThrow(/Listen/);
    x.heardAt = at;
    expect(() => respond(s, 'wrong', 0, at)).toThrow();
    expect(() => respond(s, x.id, 11, at)).toThrow();
    expect(() => respond(s, x.id, 1.5, at)).toThrow();
    s = respond(s, x.id, 0, at);
    expect(s.rounds[0].suggestions[0].response?.value).toBe(0);
    expect(currentSuggestion(s)?.position).toBe(2);
    expect(() => respond(s, x.id, 2, at)).toThrow();
    expect(() => canGenerate(s)).toThrow();
  });
  it('enforces reassessment after every 3 complete rounds and can continue indefinitely', () => {
    let s = fixture();
    for (let n = 1; n <= 30; n++) {
      s = round(s);
      for (let i = 0; i < TYPES.length; i++) {
        const x = currentSuggestion(s)!;
        x.heardAt = at;
        s = respond(s, x.id, i % 2 ? null : i, at);
      }
      expect(s.rounds.at(-1)?.completedAt).toBe(at);
      expect(needsReassessment(s)).toBe(n % 3 === 0);
      if (n % 3 === 0) {
        expect(() => canGenerate(s)).toThrow(/check-in/);
        expect(() => reassess(s, { 'Physical pain': 4 }, at)).toThrow();
        s = reassess(s, { 'Physical pain': 4, 'Uncomfortable physical sensation': 4 }, at);
        expect(needsReassessment(s)).toBe(false);
      }
      canGenerate(s);
    }
    expect(s.reassessments).toHaveLength(10);
  });
  it('does not count a partial round as complete; stop prevents further responses and generation', () => {
    let s = round(fixture());
    currentSuggestion(s)!.heardAt = at;
    s = respond(s, currentSuggestion(s)!.id, null, at);
    expect(s.rounds[0].completedAt).toBeUndefined();
    expect(needsReassessment(s)).toBe(false);
    s.status = 'stopped';
    expect(() => canGenerate(s)).toThrow();
    expect(() => respond(s, currentSuggestion(s)!.id, 0, at)).toThrow();
  });
  it('validates exact intensity keys and consent without default ratings', () => {
    expect(() =>
      exactRatings(['Physical pain', 'Uncomfortable physical sensation'], {
        'Physical pain': 0,
        'Uncomfortable physical sensation': 10,
      }),
    ).not.toThrow();
    for (const r of [
      { 'Physical pain': 2 },
      { 'Physical pain': 11, 'Uncomfortable physical sensation': 0 },
      { 'Physical pain': 3, 'Uncomfortable physical sensation': 0, Other: 1 },
    ] as Record<string, number>[])
      expect(() =>
        exactRatings(['Physical pain', 'Uncomfortable physical sensation'], r),
      ).toThrow();
    expect(() =>
      exactRatings(['Physical pain', 'Physical pain'], { 'Physical pain': 0 }),
    ).toThrow();
    expect(
      baselineSchema.safeParse({
        experiences: ['Physical pain'],
        ratings: { 'Physical pain': 0 },
        consent: false,
        adult: true,
      }).success,
    ).toBe(false);
  });
  it('rejects repeated suggestion types/text', () => {
    const text = 'A gentle grounded suggestion '.repeat(4);
    expect(
      generatedSchema.safeParse({ suggestions: TYPES.map((type) => ({ type, text })) }).success,
    ).toBe(false);
    expect(
      generatedSchema.safeParse({ suggestions: TYPES.map((type, i) => ({ type, text: text + i })) })
        .success,
    ).toBe(true);
  });
  it('generation leases expire without allowing a fresh duplicate', () => {
    const s = fixture();
    s.generation = { id: 'a', at: new Date().toISOString() };
    expect(() => canGenerate(s)).toThrow(/prepared/);
    s.generation.at = '2000-01-01T00:00:00.000Z';
    expect(() => canGenerate(s)).not.toThrow();
  });
});
describe('CSV safety', () => {
  it('quotes arbitrary text and neutralises spreadsheet formulas', () => {
    const data = csv([
      { text: '=HYPERLINK("x")', n: 0 },
      { text: 'a,"b"\nc', n: null },
      { text: '  @SUM(A1)', n: 1 },
    ]);
    expect(data).toContain('"\'=HYPERLINK(""x"")"');
    expect(data).toContain('"a,""b""\nc"');
    expect(data).toContain('"\'  @SUM(A1)"');
    expect(csv([])).toBe('');
  });
});

it('requires current physical symptoms, explicit eligibility and a positive baseline', () => {
  const valid = {
    experiences: ['Physical pain'],
    ratings: { 'Physical pain': 3 },
    consent: true,
    adult: true,
    physicalEligibility: true,
  };
  expect(baselineSchema.safeParse(valid).success).toBe(true);
  expect(baselineSchema.safeParse({ ...valid, physicalEligibility: false }).success).toBe(false);
  expect(baselineSchema.safeParse({ ...valid, physicalEligibility: undefined }).success).toBe(
    false,
  );
  expect(
    baselineSchema.safeParse({ ...valid, experiences: ['Anxiety'], ratings: { Anxiety: 5 } })
      .success,
  ).toBe(false);
  expect(baselineSchema.safeParse({ ...valid, ratings: { 'Physical pain': 0 } }).success).toBe(
    false,
  );
  expect(
    baselineSchema.safeParse({
      ...valid,
      experiences: ['Physical pain', 'Uncomfortable physical sensation'],
      ratings: { 'Physical pain': 0, 'Uncomfortable physical sensation': 2 },
    }).success,
  ).toBe(true);
});
it('retains legacy sessions without silently generating rounds under the new protocol', () => {
  const s = fixture();
  s.protocolVersion = 'eyes-closed-v1';
  const before = structuredClone(s);
  expect(() => canGenerate(s)).toThrow(/earlier protocol/);
  expect(s).toEqual(before);
});
