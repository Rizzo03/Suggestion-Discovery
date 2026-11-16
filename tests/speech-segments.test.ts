import { it, expect } from 'vitest';
import { speechSegments, SENTENCE_PAUSE_SECONDS } from '../lib/speech-segments';
import { assembleSuggestions } from '../lib/suggestion-content';
it('segments punctuation without speaking pause markers or changing sentence order', () => {
  expect(speechSegments('Notice the chair.  Attend to a sound! Allow a moment?')).toEqual([
    'Notice the chair.',
    'Attend to a sound!',
    'Allow a moment?',
  ]);
  expect(SENTENCE_PAUSE_SECONDS).toBe(2);
});
it('uses identical pause boundaries for matched direct and permissive instructions', () => {
  const bodies = [
    'notice the support of your chair beneath you',
    'allow a moment for your attention to rest here',
    'notice a sound in the room around you',
  ];
  const result = assembleSuggestions({
    pairedInstructions: bodies,
    metaphor: 'An ordinary comparison with room for your experience. '.repeat(2),
    imagery: 'Imagine a quiet place with room to notice your experience. '.repeat(2),
    attentional_shift: 'Notice one sound nearby and then a sound farther away. '.repeat(2),
  });
  const direct = speechSegments(result.suggestions.find((s) => s.type === 'direct')!.text);
  const permissive = speechSegments(result.suggestions.find((s) => s.type === 'permissive')!.text);
  expect(direct).toHaveLength(bodies.length);
  expect(permissive).toHaveLength(bodies.length);
  direct.forEach((s, i) =>
    expect(s.slice('Now, '.length)).toBe(permissive[i].slice('Invite yourself to '.length)),
  );
});
it('rejects empty text and excessive sentence counts', () => {
  expect(() => speechSegments(' ')).toThrow();
  expect(() => speechSegments('Notice this. '.repeat(17))).toThrow();
});
