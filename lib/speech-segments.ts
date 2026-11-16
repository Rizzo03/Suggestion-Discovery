export const AUDIO_PROTOCOL_VERSION = 'sentence-pauses-v1';
export const SENTENCE_PAUSE_SECONDS = 2;
export function speechSegments(text: string) {
  const segments = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)]
    .map((x) => x.segment.trim())
    .filter(Boolean);
  if (!segments.length || segments.length > 16) throw new Error('Unsupported sentence count');
  return segments;
}
