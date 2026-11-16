export const AUDIO_PROTOCOL_VERSION = 'sentence-pauses-v3';
export const SENTENCE_PAUSE_SECONDS = 4;
export function speechSegments(text: string) {
  const segments = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)]
    .map((x) => x.segment.trim())
    .filter(Boolean);
  if (!segments.length || segments.length > 16) throw new Error('Unsupported sentence count');
  return segments;
}

export const SPEECH_SPEED = 0.8;
