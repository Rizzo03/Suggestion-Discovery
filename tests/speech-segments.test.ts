import { it, expect } from 'vitest';
import { speechSegments, SENTENCE_PAUSE_SECONDS } from '../lib/speech-segments';
import { assembleSuggestions } from '../lib/suggestion-content';
it('segments punctuation without speaking pause markers or changing sentence order', () => {
  expect(speechSegments('Notice the chair.  Attend to a sound! Allow a moment?')).toEqual([
    'Notice the chair.',
    'Attend to a sound!',
    'Allow a moment?',
  ]);
  expect(SENTENCE_PAUSE_SECONDS).toBe(4);
});
it('uses identical pause boundaries for matched direct and permissive instructions', () => {
  const bodies = [
    'notice the support of your chair beneath you',
    'allow a moment for your attention to rest here',
    'notice a sound in the room around you',
  ];
  const result = assembleSuggestions({
    external_attention: bodies,
    imagery: bodies.map((x) => 'imagine how you might ' + x),
    metaphorical_reframing: bodies.map((x) => 'picture a comparison and ' + x),
  });
  const direct = speechSegments(
    result.suggestions.find((s) => s.type === 'external_attention_direct')!.text,
  );
  const permissive = speechSegments(
    result.suggestions.find((s) => s.type === 'external_attention_permissive')!.text,
  );
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
