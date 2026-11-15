/** Prepend a fixed silent lead-in to uncompressed Speech API WAV audio.
 * Native play/pause/volume controls and mobile user-gesture playback stay intact.
 */
export function withSilentLeadIn(wav: Buffer, seconds = 3): Buffer {
  if (
    wav.length < 44 ||
    wav.toString('ascii', 0, 4) !== 'RIFF' ||
    wav.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw new Error('Expected uncompressed WAV audio');
  let alignment = 0;
  let rate = 0;
  let bits = 0;
  let format = 0;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const name = wav.toString('ascii', offset, offset + 4);
    const declaredSize = wav.readUInt32LE(offset + 4);
    // Streaming WAV writers may use an unknown-length marker for the final data chunk.
    const size =
      name === 'data' && declaredSize === 0xffffffff ? wav.length - offset - 8 : declaredSize;
    if (offset + 8 + size > wav.length) throw new Error('Truncated WAV audio');
    if (name === 'fmt ' && size >= 16) {
      format = wav.readUInt16LE(offset + 8);
      rate = wav.readUInt32LE(offset + 16);
      alignment = wav.readUInt16LE(offset + 20);
      bits = wav.readUInt16LE(offset + 22);
    }
    if (name === 'data') {
      if (
        ![1, 3].includes(format) ||
        !alignment ||
        !rate ||
        !Number.isFinite(seconds) ||
        seconds < 0 ||
        seconds > 10
      )
        throw new Error('Unsupported WAV format');
      const silence = Buffer.alloc(
        Math.round((rate * seconds) / alignment) * alignment,
        format === 1 && bits === 8 ? 128 : 0,
      );
      const result = Buffer.concat([
        wav.subarray(0, offset + 8),
        silence,
        wav.subarray(offset + 8),
      ]);
      result.writeUInt32LE(result.length - 8, 4);
      result.writeUInt32LE(size + silence.length, offset + 4);
      return result;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('Missing WAV data');
}
