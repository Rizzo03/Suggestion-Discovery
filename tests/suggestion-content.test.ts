import { describe, it, expect } from 'vitest';
import { zodResponseFormat } from 'openai/helpers/zod';
import { assembleSuggestions, containsTry, roundContentSchema } from '../lib/suggestion-content';
import { CONTENT_CATEGORIES } from '../lib/study';
export const contentFixture = () => ({
  external_attention: [
    'notice the sound of the room around you',
    'attend to the support of the chair beneath you',
    'notice how a nearby sound begins and ends',
  ],
  imagery: [
    'imagine an ordinary quiet room with a comfortable chair',
    'picture the light across a wall in that imagined room',
    'imagine leaving the scene whenever you wish',
  ],
  metaphorical_reframing: [
    'picture your relationship to the physical sensation as carrying a bag',
    'consider how a bag can be present without determining every step',
    'allow this comparison to offer room for choosing your next response',
  ],
});
describe('three content categories by two wording styles', () => {
  it('constructs six unique cells with byte-identical instruction bodies within each pair', () => {
    const input = contentFixture(),
      result = assembleSuggestions(input);
    expect(result.suggestions).toHaveLength(6);
    for (const category of CONTENT_CATEGORIES) {
      const direct = result.suggestions.find(
        (x) => x.contentCategory === category && x.deliveryStyle === 'direct',
      )!;
      const permissive = result.suggestions.find(
        (x) => x.contentCategory === category && x.deliveryStyle === 'permissive',
      )!;
      expect(direct.text).toBe(input[category].map((body) => `Now, ${body}.`).join(' '));
      expect(permissive.text).toBe(input[category].map((body) => `You might ${body}.`).join(' '));
      expect(direct.type).toBe(`${category}_direct`);
      expect(permissive.type).toBe(`${category}_permissive`);
    }
    expect(result.instructionPairs).toEqual(input);
    expect(new Set(result.suggestions.map((x) => x.type)).size).toBe(6);
  });
  it('rejects prohibited wording in every content family', () => {
    for (const category of CONTENT_CATEGORIES) {
      const input = contentFixture();
      input[category][0] = 'try noticing this physical experience';
      expect(() => assembleSuggestions(input)).toThrow(/prohibited/);
    }
    for (const word of ['try', 'TRY', 'trying', 'tried', 'tries', 'ＴＲＹ'])
      expect(containsTry(word)).toBe(true);
    expect(containsTry('Notice the geometry of the room and a nearby tree.')).toBe(false);
  });
  it('rejects malformed shared bodies and missing categories', () => {
    for (const body of [
      'Notice the chair beneath you',
      ' notice the chair beneath you',
      'notice the chair beneath you.',
      'notice the chair\nthen stop',
    ]) {
      const input = contentFixture();
      input.external_attention[0] = body;
      expect(() => assembleSuggestions(input)).toThrow();
    }
    expect(
      roundContentSchema.safeParse({ external_attention: contentFixture().external_attention })
        .success,
    ).toBe(false);
  });
  it('produces an SDK-compatible strict schema with exactly the three content families', () => {
    const format = zodResponseFormat(roundContentSchema, 'suggestion_round');
    expect(format.json_schema.strict).toBe(true);
    expect(format.json_schema.schema?.required).toEqual(
      expect.arrayContaining([...CONTENT_CATEGORIES]),
    );
  });
});
