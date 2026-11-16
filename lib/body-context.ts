import { z } from 'zod';
export const BODY_LOCATIONS = [
  'Head or face',
  'Neck',
  'Shoulder',
  'Arm or elbow',
  'Wrist or hand',
  'Chest or ribs',
  'Abdomen',
  'Pelvis',
  'Upper back',
  'Lower back',
  'Hip or buttock',
  'Thigh',
  'Knee',
  'Lower leg',
  'Ankle or foot',
  'Several body areas',
  'Another body area',
] as const;
export const EXCLUSIVE_SENSATIONS = ['Hard to describe', 'Prefer not to say'] as const;
export const ASSOCIATED_SENSATIONS = [
  'Aching',
  'Sharp or stabbing',
  'Burning',
  'Throbbing or pulsing',
  'Pressure or squeezing',
  'Tightness',
  'Pulling or stretching',
  'Cramping',
  'Tingling or pins and needles',
  'Numbness',
  'Itching',
  'Heaviness',
  'Tenderness or soreness',
  'Shooting',
  'Another sensation',
  'Hard to describe',
  'Prefer not to say',
] as const;
export const sensationsSchema = z
  .array(z.enum(ASSOCIATED_SENSATIONS))
  .max(ASSOCIATED_SENSATIONS.length)
  .superRefine((values, ctx) => {
    if (
      new Set(values).size !== values.length ||
      (values.some((x) => (EXCLUSIVE_SENSATIONS as readonly string[]).includes(x)) &&
        values.length > 1)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Choose sensation qualities or one exclusive alternative.',
      });
  });
export const SYMPTOM_DURATIONS = ['Less than 3 months', '3 months or longer'] as const;
export const EXCLUSIVE_FEELINGS = [
  'None of these',
  'Not aware of feelings',
  'Prefer not to say',
] as const;
export const ASSOCIATED_FEELINGS = [
  'Worry',
  'Anxiety',
  'Frustration',
  'Sadness',
  'Anger',
  'Helplessness',
  'Feeling overwhelmed',
  'Irritability',
  'Tension',
  'Discouragement',
  'Calm',
  'Hopefulness',
  'None of these',
  'Not aware of feelings',
  'Prefer not to say',
] as const;
export const feelingsSchema = z
  .array(z.enum(ASSOCIATED_FEELINGS))
  .max(15)
  .superRefine((values, ctx) => {
    if (
      new Set(values).size !== values.length ||
      (values.some((x) => (EXCLUSIVE_FEELINGS as readonly string[]).includes(x)) &&
        values.length > 1)
    )
      ctx.addIssue({ code: 'custom', message: 'Choose feelings or one exclusive alternative.' });
  });
export const bodyContextSchema = z.object({
  primaryLocation: z.enum(BODY_LOCATIONS),
  associatedFeelings: feelingsSchema,
  associatedSensations: sensationsSchema.optional(),
  symptomDuration: z.enum(SYMPTOM_DURATIONS).optional(),
});
export type BodyContext = z.infer<typeof bodyContextSchema>;
export function spokenLocation(location: BodyContext['primaryLocation']) {
  if (location === 'Several body areas') return 'selected body areas';
  if (location === 'Another body area') return 'selected body area';
  return location.toLowerCase();
}
