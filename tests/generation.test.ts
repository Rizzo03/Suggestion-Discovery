import { beforeEach, expect, it, vi } from 'vitest';
import { contentFixture, sampleContext } from './content-fixture';
const mocks = vi.hoisted(() => ({ create: vi.fn(), moderate: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mocks.create } };
    moderations = { create: mocks.moderate };
  },
}));
import { generate } from '../lib/ai';
function response(content: unknown, extra = {}) {
  return {
    model: 'test',
    id: 'response',
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content), ...extra } }],
  };
}
beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-test-key');
  mocks.create.mockReset();
  mocks.moderate.mockReset();
  mocks.moderate.mockResolvedValue({ results: [{ flagged: false }] });
});
it('repairs a malformed round once and moderates only the accepted final texts', async () => {
  const invalid = contentFixture();
  invalid.sensory_discriminative.direct =
    'Notice your lower back and the changing qualities and boundaries of sensation.';
  mocks.create
    .mockResolvedValueOnce(response(invalid))
    .mockResolvedValueOnce(response(contentFixture()));
  const result = await generate(['Physical pain'], sampleContext);
  expect(result.suggestions).toHaveLength(6);
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(mocks.create.mock.calls[1][0].messages.at(-1).content).toContain(
    'Direct suggestions must begin',
  );
  expect(mocks.moderate).toHaveBeenCalledTimes(1);
  expect(mocks.moderate.mock.calls[0][0].input).toEqual(result.suggestions.map((x) => x.text));
});
it('stops after two invalid responses without exposing or moderating failed text', async () => {
  mocks.create.mockResolvedValue(response({ invalid: true }));
  await expect(generate(['Physical pain'], sampleContext)).rejects.toThrow('A suitable round');
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(mocks.moderate).not.toHaveBeenCalled();
});
it('does not retry refusals or bypass flagged moderation', async () => {
  mocks.create.mockResolvedValue(response(contentFixture(), { refusal: 'declined' }));
  await expect(generate(['Physical pain'], sampleContext)).rejects.toThrow('A suitable round');
  expect(mocks.create).toHaveBeenCalledTimes(1);
  mocks.create.mockReset().mockResolvedValue(response(contentFixture()));
  mocks.moderate.mockResolvedValue({ results: [{ flagged: true }] });
  await expect(generate(['Physical pain'], sampleContext)).rejects.toThrow('A suitable round');
  expect(mocks.create).toHaveBeenCalledTimes(1);
});

it('reports exact failed-field counts and closing-adjusted word budgets to the retry', async () => {
  const invalid = contentFixture();
  invalid.sensory_discriminative.direct =
    'Your lower back can feel different. Notice its boundaries gently. Stop whenever you wish.';
  mocks.create
    .mockResolvedValueOnce(response(invalid))
    .mockResolvedValueOnce(response(contentFixture()));
  const result = await generate(['Physical pain'], sampleContext);
  const correction = mocks.create.mock.calls[1][0].messages.at(-1).content;
  expect(correction).toContain('sensory_discriminative_direct: final text has 4 sentences');
  expect(correction).toContain('exactly 3 body sentences');
  expect(correction).toContain('preserving compliant texts verbatim');
  expect(result.generationMessages.at(-1)?.content).toBe(correction);
  expect(result.generationRepairVersion).toBe('field-count-feedback-1');
  expect(
    result.suggestions.every(
      (x) => x.wordCount >= 65 && x.wordCount <= 85 && x.sentenceCount === 4,
    ),
  ).toBe(true);
});
