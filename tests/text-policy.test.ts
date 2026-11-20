import { expect, it } from 'vitest';
import { meetsTextPolicy, textStatistics } from '../lib/text-policy';
import { contentFixture, sampleContext } from './content-fixture';
import { assembleSuggestions } from '../lib/suggestion-content';
import { pilotSnapshot, PILOT_PROFILE } from '../lib/pilot';
it('requires four final sentences and comparable word counts across all six forms', () => {
  const result = assembleSuggestions(contentFixture(), sampleContext);
  for (const text of result.suggestions) {
    expect(text.sentenceCount).toBe(4);
    expect(text.wordCount).toBeGreaterThanOrEqual(65);
    expect(text.wordCount).toBeLessThanOrEqual(85);
    expect(meetsTextPolicy(text.text)).toBe(true);
  }
  expect(meetsTextPolicy('A short sentence.')).toBe(false);
  expect(meetsTextPolicy('Notice this. '.repeat(40))).toBe(false);
  const invalid = contentFixture();
  invalid.affective_motivational.direct += ' Another sentence.';
  expect(() => assembleSuggestions(invalid, sampleContext)).toThrow(/four sentences/);
});
it('stores a versioned protocol snapshot without credentials', () => {
  const snapshot = pilotSnapshot({ text: 'text-model', audio: 'audio-model', voice: 'voice' });
  expect(snapshot.pilotVersion).toBe('pilot-1.0');
  expect(snapshot.textPolicy).toEqual(PILOT_PROFILE.textPolicy);
  expect(snapshot.models.text).toBe('text-model');
  expect(textStatistics('One word. Two words.')).toEqual({ wordCount: 4, sentenceCount: 2 });
});
