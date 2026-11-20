import { it, expect } from 'vitest';
import { speechSegments, SENTENCE_PAUSE_SECONDS, SPEECH_SPEED } from '../lib/speech-segments';
import { assembleSuggestions } from '../lib/suggestion-content';
import { contentFixture, sampleContext } from './content-fixture';
it('segments punctuation without speaking pause markers or changing sentence order', () => {
  expect(speechSegments('Notice the chair. Attend to a sound! Allow a moment?')).toEqual([
    'Notice the chair.',
    'Attend to a sound!',
    'Allow a moment?',
  ]);
  expect(SENTENCE_PAUSE_SECONDS).toBe(4);
  expect(SPEECH_SPEED).toBe(0.8);
});
it('segments all six location-specific recordings without inserting spoken pause instructions', () => {
  for (const suggestion of assembleSuggestions(contentFixture(), sampleContext).suggestions) {
    const segments = speechSegments(suggestion.text);
    expect(segments).toHaveLength(4);
    if (suggestion.closingSentence) expect(segments.at(-1)).toBe(suggestion.closingSentence);
    expect(segments.join(' ')).toBe(suggestion.text);
  }
});
it('rejects empty text and excessive sentence counts', () => {
  expect(() => speechSegments(' ')).toThrow();
  expect(() => speechSegments('Notice this. '.repeat(17))).toThrow();
});
