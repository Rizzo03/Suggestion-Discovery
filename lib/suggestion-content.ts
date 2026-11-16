import { z } from 'zod';
import { CONTENT_CATEGORIES, DELIVERY_STYLES, generatedSchema } from './study';
import { BodyContext, spokenLocation } from './body-context';
const targetSchema = z.object({
  goal: z.string().min(10).max(400),
  direct: z.string().min(60).max(1800),
  imagery: z.string().min(60).max(1800),
  metaphorical: z.string().min(60).max(1800),
});
export const roundContentSchema = z.object({
  sensory_discriminative: targetSchema,
  affective_motivational: targetSchema,
});
export function containsTry(text: string) {
  return /\b(?:try|tries|tried|trying)\b/i.test(text.normalize('NFKC'));
}
const normal = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export function assembleSuggestions(
  input: z.infer<typeof roundContentSchema>,
  context: BodyContext,
) {
  const location = normal(spokenLocation(context.primaryLocation));
  const suggestions = CONTENT_CATEGORIES.flatMap((contentCategory) =>
    DELIVERY_STYLES.map((deliveryStyle) => ({
      type: `${contentCategory}_${deliveryStyle}`,
      contentCategory,
      deliveryStyle,
      targetGoal: input[contentCategory].goal,
      text: input[contentCategory][deliveryStyle].trim(),
    })),
  );
  const checked = generatedSchema.parse({ suggestions });
  if (suggestions.some((x) => containsTry(x.text) || containsTry(x.targetGoal)))
    throw new Error('Suggestion contains prohibited wording');
  for (const suggestion of suggestions) {
    const text = normal(suggestion.text);
    if (!text.includes(location))
      throw new Error('Every suggestion must name the selected body area');
    if (suggestion.deliveryStyle === 'direct' && !text.startsWith(`your ${location}`))
      throw new Error('Direct suggestions must begin with the selected body area');
    if (suggestion.deliveryStyle === 'imagery' && !text.startsWith(`imagine your ${location}`))
      throw new Error('Imagery suggestions must begin with Imagine and the selected body area');
  }
  return {
    suggestions: suggestions.map((x, i) => ({ ...x, type: checked.suggestions[i].type })),
    targetGoals: {
      sensory_discriminative: input.sensory_discriminative.goal,
      affective_motivational: input.affective_motivational.goal,
    },
  };
}
