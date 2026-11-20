import { beforeEach, expect, it, vi } from 'vitest';
import { sampleContext } from './content-fixture';
import { generationContentSchema } from '../lib/suggestion-content';
const mocks = vi.hoisted(() => ({ create: vi.fn(), moderate: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mocks.create } };
    moderations = { create: mocks.moderate };
  },
}));
import { generate } from '../lib/ai';
function content() {
  const sentence = (prefix: string) =>
    `${prefix} ${Array(19 - prefix.split(' ').length)
      .fill('gently')
      .join(' ')}.`;
  const target = (count: number) => ({
    goal: 'Explore a possible change in experience',
    direct: [
      sentence('Your lower back'),
      ...Array.from({ length: count - 1 }, (_, i) =>
        sentence(`Notice sensation ${i ? 'again' : 'now'}`),
      ),
    ],
    imagery: [
      sentence('Imagine your lower back'),
      ...Array.from({ length: count - 1 }, (_, i) =>
        sentence(`Imagine experience ${i ? 'again' : 'now'}`),
      ),
    ],
    metaphorical: [
      sentence('Your lower back is like weather'),
      ...Array.from({ length: count - 1 }, (_, i) =>
        sentence(`Consider comparison ${i ? 'again' : 'now'}`),
      ),
    ],
  });
  // Distinguish the two target texts without changing their constrained lengths.
  const affective = target(4);
  affective.direct[1] = sentence('Notice emotional response');
  affective.imagery[1] = sentence('Imagine emotional response');
  affective.metaphorical[1] = sentence('Consider emotional response');
  return { sensory_discriminative: target(3), affective_motivational: affective };
}
function response(value: unknown, extra = {}) {
  return {
    model: 'test',
    id: 'response',
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value), ...extra } }],
  };
}
beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-test-key');
  mocks.create.mockReset();
  mocks.moderate.mockReset();
  mocks.moderate.mockResolvedValue({ results: [{ flagged: false }] });
});
it('repairs a malformed round once and moderates only accepted final texts', async () => {
  const invalid = content();
  invalid.sensory_discriminative.direct[0] = invalid.sensory_discriminative.direct[0].replace(
    'Your lower back',
    'Near lower back',
  );
  mocks.create.mockResolvedValueOnce(response(invalid)).mockResolvedValueOnce(response(content()));
  const result = await generate(['Physical pain'], sampleContext);
  expect(result.suggestions).toHaveLength(6);
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(mocks.create.mock.calls[1][0].messages.at(-1).content).toContain(
    'Direct suggestions must begin',
  );
  expect(mocks.moderate.mock.calls[0][0].input).toEqual(result.suggestions.map((x) => x.text));
  expect(result.generationMessages.at(-1)?.content).toContain('Direct suggestions must begin');
});
it('stops after two invalid responses without moderating failed text', async () => {
  mocks.create.mockResolvedValue(response({ invalid: true }));
  await expect(generate(['Physical pain'], sampleContext)).rejects.toThrow('A suitable round');
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(mocks.moderate).not.toHaveBeenCalled();
});
it('does not retry refusals or bypass flagged moderation', async () => {
  mocks.create.mockResolvedValue(response(content(), { refusal: 'declined' }));
  await expect(generate(['Physical pain'], sampleContext)).rejects.toThrow('A suitable round');
  expect(mocks.create).toHaveBeenCalledTimes(1);
  mocks.create.mockReset().mockResolvedValue(response(content()));
  mocks.moderate.mockResolvedValue({ results: [{ flagged: true }] });
  await expect(generate(['Physical pain'], sampleContext)).rejects.toThrow('A suitable round');
  expect(mocks.create).toHaveBeenCalledTimes(1);
});
it('constrains sentence lengths in the provider schema and validates all final texts', async () => {
  const valid = content();
  expect(generationContentSchema.safeParse(valid).success).toBe(true);
  const short = content();
  short.sensory_discriminative.direct[0] = 'Your lower back can feel different.';
  expect(generationContentSchema.safeParse(short).success).toBe(false);
  const extra = content();
  extra.affective_motivational.imagery.push(extra.affective_motivational.imagery[0]);
  expect(generationContentSchema.safeParse(extra).success).toBe(false);
  mocks.create.mockResolvedValue(response(valid));
  const result = await generate(['Physical pain'], sampleContext);
  const schema = mocks.create.mock.calls[0][0].response_format.json_schema.schema;
  expect(schema.properties.sensory_discriminative.properties.direct.items.pattern).toContain(
    '{17,19}',
  );
  expect(result.generationRepairVersion).toBe('sentence-array-2');
  expect(
    result.suggestions.every(
      (x) => x.wordCount >= 65 && x.wordCount <= 85 && x.sentenceCount === 4,
    ),
  ).toBe(true);
});
