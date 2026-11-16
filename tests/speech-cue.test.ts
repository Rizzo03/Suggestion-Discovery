import { expect, it, vi } from 'vitest';
import { END_CUE } from '../lib/audio-cue';
import { AUDIO_PROTOCOL_VERSION } from '../lib/speech-segments';
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    audio = { speech: { create: mocks.create } };
  },
}));
import { speech } from '../lib/ai';
it('encodes the end cue into the actual speech result without asking TTS to speak it', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-test-key');
  const bytes = Buffer.alloc(48);
  bytes.write('RIFF');
  bytes.writeUInt32LE(40, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(24000, 24);
  bytes.writeUInt32LE(48000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(4, 40);
  bytes.writeInt16LE(1000, 44);
  mocks.create.mockResolvedValue({
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
    headers: new Headers({ 'x-request-id': 'test' }),
  });
  const result = await speech('Notice the sensation. It can feel softer.');
  expect(mocks.create.mock.calls.map((x) => x[0].input)).toEqual([
    'Notice the sensation.',
    'It can feel softer.',
  ]);
  expect(result.endCue).toEqual(END_CUE);
  expect(result.protocolVersion).toBe(AUDIO_PROTOCOL_VERSION);
  expect(result.bytes.length).toBe(44 + 3 * 48000 + 4 * 48000 + 8 + 48000);
  expect(result.bytes.readUInt32LE(40)).toBe(result.bytes.length - 44);
  expect(result.bytes.subarray(result.bytes.length - 4800).every((x) => x === 0)).toBe(true);
});
