import { describe, it, expect } from 'vitest';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  assembleSuggestions,
  containsTry,
  roundContentSchema,
  sensoryClosing,
} from '../lib/suggestion-content';
import { CONTENT_CATEGORIES, DELIVERY_STYLES, TYPES } from '../lib/study';
import { contentFixture, sampleContext } from './content-fixture';
describe('two experiential targets crossed with three delivery forms', () => {
  it('constructs exactly the six target/form cells with region-specific text and target goals', () => {
    const input = contentFixture(),
      result = assembleSuggestions(input, sampleContext);
    expect(result.suggestions.map((x) => x.type)).toEqual([...TYPES]);
    expect(result.suggestions).toHaveLength(6);
    for (const category of CONTENT_CATEGORIES)
      for (const style of DELIVERY_STYLES) {
        const x = result.suggestions.find(
          (x) => x.contentCategory === category && x.deliveryStyle === style,
        )!;
        expect(x.text).toBe(
          category === 'sensory_discriminative'
            ? `${input[category][style]} ${sensoryClosing(style, sampleContext)}`
            : input[category][style],
        );
        expect(x.text.toLowerCase()).toContain('lower back');
        expect(x.targetGoal).toBe(input[category].goal);
      }
    expect(result.targetGoals.sensory_discriminative).not.toBe(
      result.targetGoals.affective_motivational,
    );
  });
  it('rejects the prohibited word in every target/form combination', () => {
    for (const category of CONTENT_CATEGORIES)
      for (const style of DELIVERY_STYLES) {
        const input = contentFixture();
        input[category][style] += ' Try this.';
        expect(() => assembleSuggestions(input, sampleContext)).toThrow(/prohibited/);
      }
    for (const word of ['try', 'TRY', 'trying', 'tried', 'tries', 'ＴＲＹ'])
      expect(containsTry(word)).toBe(true);
    expect(containsTry('Notice the geometry of a nearby tree.')).toBe(false);
  });
  it('fails closed if a location is missing, the wrong area is named, or delivery introductions are wrong', () => {
    const missing = contentFixture();
    missing.affective_motivational.metaphorical =
      'Consider a bag of feelings and a quiet room without any named physical location.';
    expect(() => assembleSuggestions(missing, sampleContext)).toThrow(/body area/);
    expect(() =>
      assembleSuggestions(contentFixture(), {
        primaryLocation: 'Shoulder',
        associatedFeelings: [],
      }),
    ).toThrow();
    const prefix = contentFixture();
    prefix.sensory_discriminative.direct =
      'You might notice your lower back and the changing edges of the physical sensation.';
    expect(() => assembleSuggestions(prefix, sampleContext)).toThrow(/Direct/);
    const image = contentFixture();
    image.affective_motivational.imagery =
      'Picture your lower back as a place with room to choose how to respond to discomfort.';
    expect(() => assembleSuggestions(image, sampleContext)).toThrow(/Imagery/);
  });
  it('requires both targets and all three forms in an SDK-compatible strict output schema', () => {
    expect(
      roundContentSchema.safeParse({
        sensory_discriminative: contentFixture().sensory_discriminative,
      }).success,
    ).toBe(false);
    const format = zodResponseFormat(roundContentSchema, 'suggestion_round');
    expect(format.json_schema.strict).toBe(true);
    expect(format.json_schema.schema?.required).toEqual(
      expect.arrayContaining([...CONTENT_CATEGORIES]),
    );
  });
});

it('rejects explicit comparisons in imagery for both targets while retaining metaphorical forms', () => {
  for (const category of CONTENT_CATEGORIES) {
    for (const comparison of [
      'like a river',
      'as if it were a river',
      'as though it were weather',
      'compared with a landscape',
      'a symbolic river',
    ]) {
      const input = contentFixture();
      input[category].imagery =
        `Imagine your lower back ${comparison}. Notice the experience and choose whether to continue imagining.`;
      expect(() => assembleSuggestions(input, sampleContext)).toThrow(/without comparisons/);
    }
  }
  expect(assembleSuggestions(contentFixture(), sampleContext).suggestions).toHaveLength(6);
});

it('ends all sensory forms with a possible physical change and preserves affective text', () => {
  const input = contentFixture();
  for (const location of ['Abdomen', 'Several body areas'] as const) {
    const context = { ...sampleContext, primaryLocation: location };
    const area = location === 'Abdomen' ? 'abdomen' : 'selected body areas';
    const local = JSON.parse(JSON.stringify(input).replaceAll('lower back', area));
    const result = assembleSuggestions(local, context);
    for (const suggestion of result.suggestions) {
      if (suggestion.contentCategory === 'sensory_discriminative') {
        expect(suggestion.text.endsWith(sensoryClosing(suggestion.deliveryStyle, context))).toBe(
          true,
        );
        expect(suggestion.generatedBody).toBe(
          local.sensory_discriminative[suggestion.deliveryStyle],
        );
        expect(suggestion.textAssembly).toBe('sensory-closing-2');
        expect(suggestion.closingSentence).toMatch(/softer.*less intense/);
        expect(suggestion.closingSentence).toContain(area);
        expect(suggestion.closingSentence).not.toMatch(/will|must|pain.free|calm|happy/);
        if (suggestion.deliveryStyle === 'imagery')
          expect(suggestion.closingSentence).toMatch(/^Imagine/);
      } else {
        expect(suggestion.text).toBe(local.affective_motivational[suggestion.deliveryStyle]);
        expect(suggestion.closingSentence).toBeUndefined();
      }
    }
  }
});

it('adds the sensory closing exactly once even when the model repeats it or varies case and punctuation', () => {
  for (const style of DELIVERY_STYLES) {
    const closing = sensoryClosing(style, sampleContext);
    const clean = contentFixture();
    const expected = assembleSuggestions(clean, sampleContext).suggestions.find(
      (s) => s.type === `sensory_discriminative_${style}`,
    )!.text;
    for (const ending of [
      closing,
      closing.toLowerCase(),
      `${closing} ${closing}`,
      `${closing}\n\n${closing.toUpperCase()}`,
      closing.replace(/\.$/, '!'),
      closing.replace(/ /g, '  ').replace(/\.$/, ''),
      closing.normalize('NFKC'),
    ]) {
      const input = contentFixture();
      input.sensory_discriminative[style] += ` ${ending}`;
      const result = assembleSuggestions(input, sampleContext).suggestions.find(
        (s) => s.type === `sensory_discriminative_${style}`,
      )!;
      expect(result.text).toBe(expected);
      expect(result.generatedBody).toBe(input.sensory_discriminative[style]);
      expect(result.text.split(closing).length - 1).toBe(1);
    }
  }
});
it('retains other sentences while moving the single closing to the end', () => {
  const input = contentFixture(),
    closing = sensoryClosing('direct', sampleContext);
  const original = input.sensory_discriminative.direct;
  const parts = original.split(/(?<=\.)\s+/);
  input.sensory_discriminative.direct = `${parts[0]} ${closing} ${parts.slice(1).join(' ')} ${closing}`;
  const result = assembleSuggestions(input, sampleContext).suggestions[0];
  expect(result.text).toBe(`${original} ${closing}`);
  expect(result.text.split(closing).length - 1).toBe(1);
});
