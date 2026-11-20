import { END_CUE } from './audio-cue';
import { AUDIO_PROTOCOL_VERSION, SENTENCE_PAUSE_SECONDS, SPEECH_SPEED } from './speech-segments';
export const PILOT_PROFILE = {
  pilotVersion: 'pilot-1.0',
  protocolVersion: 'physical-targets-2x3-v5',
  consentVersion: 'physical-context-consent-4',
  promptVersion: 'physical-target-suggestions-7',
  assessmentVersion: 'resonance-1',
  textPolicy: { version: 'balanced-text-1', sentences: 4, minWords: 65, maxWords: 85 },
  audioPolicy: {
    version: AUDIO_PROTOCOL_VERSION,
    speed: SPEECH_SPEED,
    sentencePauseSeconds: SENTENCE_PAUSE_SECONDS,
    leadInSeconds: 3,
    endCue: END_CUE,
    targetMinSeconds: 55,
    targetMaxSeconds: 70,
  },
  primaryWindow: { session: 'first-eligible-per-participant-id', maxRound: 3 },
} as const;
export function pilotSnapshot(models: { text: string; audio: string; voice: string }) {
  return { ...PILOT_PROFILE, models };
}
export type PilotSnapshot = ReturnType<typeof pilotSnapshot>;
