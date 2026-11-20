/** Fixed end-of-suggestion signal, encoded in the same recording as the speech. */
export const END_CUE = {
  version: 'end-cue-1',
  frequencyHz: 660,
  durationSeconds: 0.4,
  gapSeconds: 0.5,
  tailSeconds: 0.1,
  peakAmplitude: 0.12,
  envelope: 'sine-squared',
} as const;
export type AudioEndCue = typeof END_CUE;
