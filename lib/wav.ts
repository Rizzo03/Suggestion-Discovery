import { END_CUE } from './audio-cue';
type Wave = {
  fmt: Buffer;
  samples: Buffer;
  alignment: number;
  byteRate: number;
  silenceByte: number;
};
function parseWave(wav: Buffer): Wave {
  if (
    wav.length < 44 ||
    wav.toString('ascii', 0, 4) !== 'RIFF' ||
    wav.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw new Error('Expected uncompressed WAV audio');
  let fmt: Buffer | undefined;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const name = wav.toString('ascii', offset, offset + 4);
    const declared = wav.readUInt32LE(offset + 4);
    const size = name === 'data' && declared === 0xffffffff ? wav.length - offset - 8 : declared;
    if (offset + 8 + size > wav.length) throw new Error('Truncated WAV audio');
    if (name === 'fmt ' && size >= 16) fmt = wav.subarray(offset + 8, offset + 8 + size);
    if (name === 'data') {
      if (!fmt) throw new Error('Missing WAV format');
      const format = fmt.readUInt16LE(0),
        alignment = fmt.readUInt16LE(12),
        byteRate = fmt.readUInt32LE(8),
        bits = fmt.readUInt16LE(14);
      if (![1, 3].includes(format) || !alignment || !byteRate || size % alignment)
        throw new Error('Unsupported WAV format');
      return {
        fmt,
        samples: wav.subarray(offset + 8, offset + 8 + size),
        alignment,
        byteRate,
        silenceByte: format === 1 && bits === 8 ? 128 : 0,
      };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('Missing WAV data');
}
function secondsCheck(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 10)
    throw new Error('Invalid silence duration');
}
/** Assemble a single recording with fixed silence between segments; never autoplay segments in the browser. */
export function joinWavWithPauses(clips: Buffer[], pauseSeconds = 2, leadInSeconds = 3): Buffer {
  secondsCheck(pauseSeconds);
  secondsCheck(leadInSeconds);
  if (!clips.length) throw new Error('Audio clips are required');
  const waves = clips.map(parseWave),
    first = waves[0];
  if (waves.some((w) => !w.fmt.equals(first.fmt))) throw new Error('WAV formats must match');
  const silence = (seconds: number) =>
    Buffer.alloc(
      Math.round((first.byteRate * seconds) / first.alignment) * first.alignment,
      first.silenceByte,
    );
  const chunks: Buffer[] = [silence(leadInSeconds)];
  waves.forEach((w, i) => {
    if (i) chunks.push(silence(pauseSeconds));
    chunks.push(w.samples);
  });
  const samples = Buffer.concat(chunks);
  return encodeWave(first.fmt, samples);
}
function encodeWave(fmt: Buffer, samples: Buffer) {
  const fmtPadding = fmt.length % 2,
    dataPadding = samples.length % 2;
  const result = Buffer.alloc(12 + 8 + fmt.length + fmtPadding + 8 + samples.length + dataPadding);
  result.write('RIFF', 0);
  result.writeUInt32LE(result.length - 8, 4);
  result.write('WAVEfmt ', 8);
  result.writeUInt32LE(fmt.length, 16);
  fmt.copy(result, 20);
  const dataOffset = 20 + fmt.length + fmtPadding;
  result.write('data', dataOffset);
  result.writeUInt32LE(samples.length, dataOffset + 4);
  samples.copy(result, dataOffset + 8);
  return result;
}
/** Append exactly one gently faded tone after speech; preserve all original samples. */
export function appendEndCue(wav: Buffer) {
  const wave = parseWave(wav);
  const format = wave.fmt.readUInt16LE(0),
    channels = wave.fmt.readUInt16LE(2),
    sampleRate = wave.fmt.readUInt32LE(4),
    bits = wave.fmt.readUInt16LE(14);
  if (
    format !== 1 ||
    bits !== 16 ||
    channels < 1 ||
    channels > 8 ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    wave.alignment !== channels * 2 ||
    wave.byteRate !== sampleRate * wave.alignment
  )
    throw new Error('End cue requires 16-bit PCM WAV audio');
  const frames = Math.round(sampleRate * END_CUE.durationSeconds);
  const tailFrames = Math.round(sampleRate * END_CUE.tailSeconds);
  const samples = Buffer.alloc((frames + tailFrames) * wave.alignment);
  for (let i = 0; i < frames; i++) {
    const envelope = Math.sin((Math.PI * i) / (frames - 1)) ** 2;
    const sample = Math.round(
      32767 *
        END_CUE.peakAmplitude *
        envelope *
        Math.sin((2 * Math.PI * END_CUE.frequencyHz * i) / sampleRate),
    );
    for (let channel = 0; channel < channels; channel++)
      samples.writeInt16LE(sample, i * wave.alignment + channel * 2);
  }
  return joinWavWithPauses([wav, encodeWave(wave.fmt, samples)], END_CUE.gapSeconds, 0);
}

export function withSilentLeadIn(wav: Buffer, seconds = 3) {
  return joinWavWithPauses([wav], 0, seconds);
}
