import { it, expect } from 'vitest';
import { withSilentLeadIn, joinWavWithPauses } from '../lib/wav';
function fixture() {
  const b = Buffer.alloc(48);
  b.write('RIFF');
  b.writeUInt32LE(40, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(4, 40);
  b.writeInt16LE(1200, 44);
  b.writeInt16LE(-900, 46);
  return b;
}
it('adds exactly three seconds of silence and preserves every original audio sample', () => {
  const before = fixture();
  const after = withSilentLeadIn(before);
  expect(after.length).toBe(before.length + 144000);
  expect(after.readUInt32LE(4)).toBe(after.length - 8);
  expect(after.readUInt32LE(40)).toBe(144004);
  expect(after.subarray(44, 144044).every((v) => v === 0)).toBe(true);
  expect(after.subarray(144044)).toEqual(before.subarray(44));
  expect(before.length).toBe(48);
});
it('fails closed for malformed, truncated and compressed files', () => {
  expect(() => withSilentLeadIn(Buffer.from('not wav'))).toThrow();
  expect(() => withSilentLeadIn(fixture().subarray(0, 46))).toThrow();
  const compressed = fixture();
  compressed.writeUInt16LE(6, 20);
  expect(() => withSilentLeadIn(compressed)).toThrow();
});

it('supports the unknown-length data header used by streaming WAV writers', () => {
  const b = fixture();
  b.writeUInt32LE(0xffffffff, 4);
  b.writeUInt32LE(0xffffffff, 40);
  const result = withSilentLeadIn(b);
  expect(result.readUInt32LE(40)).toBe(144004);
  expect(result.subarray(result.length - 4)).toEqual(b.subarray(44));
});

it('inserts exactly four seconds between clips, once, with no trailing pause', () => {
  const a = fixture(),
    b = fixture();
  b.writeInt16LE(3000, 44);
  const result = joinWavWithPauses([a, b], 4, 3);
  expect(result.length).toBe(44 + 144000 + 4 + 192000 + 4);
  expect(result.subarray(44 + 144000, 44 + 144000 + 4)).toEqual(a.subarray(44));
  expect(result.subarray(44 + 144000 + 4, 44 + 144000 + 4 + 192000).every((v) => v === 0)).toBe(
    true,
  );
  expect(result.subarray(result.length - 4)).toEqual(b.subarray(44));
  expect(result.readUInt32LE(40)).toBe(result.length - 44);
});
it('does not insert a sentence pause for a single clip and rejects mismatched formats', () => {
  expect(joinWavWithPauses([fixture()], 2, 3)).toEqual(withSilentLeadIn(fixture(), 3));
  const b = fixture();
  b.writeUInt32LE(22050, 24);
  expect(() => joinWavWithPauses([fixture(), b])).toThrow(/match/);
  expect(() => joinWavWithPauses([])).toThrow();
  expect(() => joinWavWithPauses([fixture()], -1)).toThrow();
});

it('preserves speech and inserts a single bounded, smoothly faded 660 Hz end cue', async () => {
  const { appendEndCue } = await import('../lib/wav');
  const { END_CUE } = await import('../lib/audio-cue');
  const original = joinWavWithPauses([fixture(), fixture()], 4, 3);
  const result = appendEndCue(original);
  const originalSamples = original.subarray(44);
  expect(result.subarray(44, 44 + originalSamples.length)).toEqual(originalSamples);
  const gapBytes = Math.round(END_CUE.gapSeconds * 48000);
  const toneFrames = Math.round(END_CUE.durationSeconds * 24000);
  const tailBytes = Math.round(END_CUE.tailSeconds * 48000);
  const cueStart = 44 + originalSamples.length + gapBytes;
  expect(result.length).toBe(original.length + gapBytes + toneFrames * 2 + tailBytes);
  expect(result.subarray(44 + originalSamples.length, cueStart).every((x) => x === 0)).toBe(true);
  const samples = Array.from({ length: toneFrames }, (_, i) =>
    result.readInt16LE(cueStart + i * 2),
  );
  expect(samples[0]).toBe(0);
  expect(samples.at(-1)).toBe(0);
  expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(3000);
  expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(
    Math.ceil(32767 * END_CUE.peakAmplitude),
  );
  // Count rising zero crossings to verify tone pitch independently of sample construction.
  const crossings = samples.flatMap((value, i) =>
    i > toneFrames / 4 && i < (3 * toneFrames) / 4 && samples[i - 1] <= 0 && value > 0 ? [i] : [],
  );
  const measuredHz = (24000 * (crossings.length - 1)) / (crossings.at(-1)! - crossings[0]);
  expect(measuredHz).toBeCloseTo(660, 0);
  expect(result.subarray(cueStart + toneFrames * 2).every((x) => x === 0)).toBe(true);
  expect(result.readUInt32LE(4)).toBe(result.length - 8);
  expect(result.readUInt32LE(40)).toBe(result.length - 44);
});
it('rejects unsupported cue formats instead of writing a corrupt recording', async () => {
  const { appendEndCue } = await import('../lib/wav');
  const audio = fixture();
  audio.writeUInt16LE(3, 20);
  audio.writeUInt16LE(32, 34);
  expect(() => appendEndCue(audio)).toThrow(/16-bit PCM/);
});
