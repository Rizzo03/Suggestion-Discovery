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
  'Prefer not to say',
] as const;
export const feelingsSchema = z
  .array(z.enum(ASSOCIATED_FEELINGS))
  .max(14)
  .superRefine((values, ctx) => {
    if (
      new Set(values).size !== values.length ||
      (values.some((x) => x === 'None of these' || x === 'Prefer not to say') && values.length > 1)
    )
      ctx.addIssue({ code: 'custom', message: 'Choose feelings or one exclusive alternative.' });
  });
export const bodyContextSchema = z.object({
  primaryLocation: z.enum(BODY_LOCATIONS),
  associatedFeelings: feelingsSchema.default([]),
});
export type BodyContext = z.infer<typeof bodyContextSchema>;
export function spokenLocation(location: BodyContext['primaryLocation']) {
  if (location === 'Several body areas') return 'selected body areas';
  if (location === 'Another body area') return 'selected body area';
  return location.toLowerCase();
}
