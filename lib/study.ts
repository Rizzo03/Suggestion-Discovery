import { z } from 'zod';
import { BODY_LOCATIONS, SYMPTOM_DURATIONS, feelingsSchema, BodyContext } from './body-context';
export const EXPERIENCES = ['Physical pain', 'Other uncomfortable physical sensation'] as const;
export const CONTENT_CATEGORIES = ['sensory_discriminative', 'affective_motivational'] as const;
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];
export const DELIVERY_STYLES = ['direct', 'imagery', 'metaphorical'] as const;
export type DeliveryStyle = (typeof DELIVERY_STYLES)[number];
export const TYPES = [
  'sensory_discriminative_direct',
  'sensory_discriminative_imagery',
  'sensory_discriminative_metaphorical',
  'affective_motivational_direct',
  'affective_motivational_imagery',
  'affective_motivational_metaphorical',
] as const;
export const STUDY_PROTOCOL_VERSION = 'physical-targets-2x3-v3';
export const CONSENT_VERSION = 'physical-context-consent-3';
export const PROMPT_VERSION = 'physical-target-suggestions-4';
export const VOICE_INSTRUCTIONS =
  'Speak in a calm, neutral, warm tone at a steady, unhurried pace. Use natural pauses. No theatrical emphasis, persuasion, whispering, or music.';
export const RESONANCE_QUESTION =
  'How much did this suggestion resonate with your current experience?';
export const RESONANCE_HELP =
  'Consider how well the suggestion connected with your experience, whether or not it changed your pain or discomfort.';
export const RESONANCE_ASSESSMENT = {
  construct: 'resonance' as const,
  version: 'resonance-1',
  question: RESONANCE_QUESTION,
  help: RESONANCE_HELP,
  anchors: { zero: 'Not at all', ten: 'Very much' },
  unableOption: 'Unable to rate',
};
export type Assessment = typeof RESONANCE_ASSESSMENT;
export type Eye = 'open' | 'closed';
export const intensitySchema = z.record(z.string(), z.number().int().min(0).max(10));
export const baselineSchema = z
  .object({
    experiences: z.array(z.enum(EXPERIENCES)).min(1).max(2),
    ratings: intensitySchema,
    consent: z.literal(true),
    adult: z.literal(true),
    physicalEligibility: z.literal(true),
    primaryLocation: z.enum(BODY_LOCATIONS),
    associatedFeelings: feelingsSchema.refine((values) => values.length > 0, {
      message: 'Select at least one feelings response.',
    }),
    symptomDuration: z.enum(SYMPTOM_DURATIONS),
  })
  .superRefine((value, ctx) => {
    if (!value.experiences.some((e) => (value.ratings[e] ?? 0) > 0))
      ctx.addIssue({
        code: 'custom',
        message:
          'At least one selected physical symptom must currently have an intensity above zero.',
      });
  });
export const generatedSchema = z
  .object({
    suggestions: z
      .array(z.object({ type: z.enum(TYPES), text: z.string().min(60).max(1800) }))
      .length(TYPES.length),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.suggestions.map((s) => s.type)).size !== TYPES.length)
      ctx.addIssue({ code: 'custom', message: 'All six content/style combinations are required.' });
    if (new Set(v.suggestions.map((s) => s.text.trim().toLowerCase())).size !== TYPES.length)
      ctx.addIssue({ code: 'custom', message: 'Suggestion texts must differ.' });
  });
export type Suggestion = {
  id: string;
  type: string;
  contentCategory?: string;
  deliveryStyle?: string;
  targetGoal?: string;
  closingSentence?: string;
  generatedBody?: string;
  textAssembly?: 'sensory-closing-1';
  text: string;
  position: number;
  audioPath?: string;
  audioSha256?: string;
  audioModel?: string;
  voice?: string;
  voiceInstructions?: string;
  audioCreatedAt?: string;
  audioRequestId?: string;
  audioLeadInSeconds?: number;
  audioPauseSeconds?: number;
  audioSpeed?: number;
  audioSegments?: string[];
  audioRequestIds?: string[];
  audioProtocolVersion?: string;
  response?: {
    value: number | null;
    at: string;
    measure?: 'resonance' | 'usefulness';
    measureVersion?: string;
  };
  heardAt?: string;
};
export type Round = {
  pairedInstructionBodies?: string[];
  instructionPairs?: Record<string, string[]>;
  targetGoals?: Record<ContentCategory, string>;
  generationContext?: BodyContext;
  protocolVersion?: string;
  id: string;
  number: number;
  eye: Eye;
  order: string[];
  randomisation: { algorithm: string; at: string };
  model: string;
  promptVersion: string;
  prompt: string;
  responseId: string;
  createdAt: string;
  completedAt?: string;
  suggestions: Suggestion[];
};
export type Study = {
  assessment?: Assessment;
  primaryLocation?: BodyContext['primaryLocation'];
  associatedFeelings?: string[];
  symptomDuration?: BodyContext['symptomDuration'];
  eligibility?: { physicalSymptomsConfirmed: boolean; adult: boolean; at: string; version: string };
  protocolVersion?: string;
  experiences: string[];
  consentVersion: string;
  consentAt: string;
  baseline: { ratings: Record<string, number>; at: string };
  reassessments: { afterRound: number; ratings: Record<string, number>; at: string }[];
  firstEye: Eye;
  allocation: { algorithm: string; at: string };
  rounds: Round[];
  status: 'active' | 'stopped';
  endedAt?: string;
  generation?: { id: string; at: string };
};
export type Session = {
  id: string;
  participant_id: string;
  state: Study;
  version: number;
  created_at: string;
};
export class StudyError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export function exactRatings(experiences: string[], ratings: Record<string, number>) {
  intensitySchema.parse(ratings);
  if (
    new Set(experiences).size !== experiences.length ||
    Object.keys(ratings).length !== experiences.length ||
    experiences.some((e) => ratings[e] === undefined)
  )
    throw new StudyError('Rate every selected experience exactly once.', 400);
}
export function needsReassessment(s: Study) {
  const n = s.rounds.filter((r) => r.completedAt).length;
  return n > 0 && n % 3 === 0 && !s.reassessments.some((r) => r.afterRound === n);
}
export function currentSuggestion(s: Study) {
  return s.rounds.at(-1)?.suggestions.find((x) => !x.response);
}
export function assertActive(s: Study) {
  if (s.status !== 'active') throw new StudyError('This session has ended.');
}
export function canGenerate(s: Study) {
  assertActive(s);
  if (s.protocolVersion !== STUDY_PROTOCOL_VERSION)
    throw new StudyError(
      'This session uses the earlier protocol. End it and begin a new session for the physical-symptom listening experience.',
    );
  if (currentSuggestion(s)) throw new StudyError('Finish the current round first.');
  if (needsReassessment(s))
    throw new StudyError('Complete your intensity check-in before continuing.');
  if (s.generation && Date.now() - Date.parse(s.generation.at) < 300_000)
    throw new StudyError('A round is being prepared. Please wait.');
}
export function eyeFor(first: Eye, number: number): Eye {
  return number % 2 === 1 ? first : first === 'open' ? 'closed' : 'open';
}
export function shuffle<T>(items: readonly T[], randomInt: (max: number) => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function respond(s: Study, id: string, value: number | null, at: string): Study {
  assertActive(s);
  const next = structuredClone(s);
  const suggestion = currentSuggestion(next);
  if (!suggestion || suggestion.id !== id || !suggestion.heardAt)
    throw new StudyError('Listen to the current suggestion before submitting a response.');
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > 10))
    throw new StudyError('Choose a rating from 0 to 10, or Unable to rate.', 400);
  suggestion.response = {
    value,
    at,
    measure: next.assessment?.construct ?? 'usefulness',
    measureVersion: next.assessment?.version ?? 'legacy-usefulness',
  };
  const round = next.rounds.at(-1)!;
  if (round.suggestions.every((x) => x.response)) round.completedAt = at;
  return next;
}
export function reassess(s: Study, ratings: Record<string, number>, at: string): Study {
  assertActive(s);
  if (!needsReassessment(s)) throw new StudyError('No check-in is due.');
  exactRatings(s.experiences, ratings);
  return {
    ...s,
    reassessments: [...s.reassessments, { afterRound: s.rounds.length, ratings, at }],
  };
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const cell = (v: unknown) => {
    let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[\s]*[=+@\-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [keys.map(cell).join(','), ...rows.map((r) => keys.map((k) => cell(r[k])).join(','))].join(
    '\r\n',
  );
}
