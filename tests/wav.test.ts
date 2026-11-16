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
