import { z } from 'zod';
import { CONTENT_CATEGORIES, DELIVERY_STYLES, DeliveryStyle, generatedSchema } from './study';
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
export function sensoryClosing(style: DeliveryStyle, context: BodyContext) {
  const location = spokenLocation(context.primaryLocation);
  if (style === 'imagery')
    return `Imagine the sensation in your ${location} becoming softer and less intense.`;
  if (style === 'metaphorical')
    return `Let this comparison suggest a softer, less intense sensation in your ${location}.`;
  return `The sensation in your ${location} can feel softer and less intense.`;
}
function appendClosingOnce(body: string, closing: string) {
  const sentenceKey = (text: string) =>
    normal(text)
      .replace(/[.!?…]+$/u, '')
      .trim();
  const closingKey = sentenceKey(closing);
  // Split at punctuation even if the next sentence starts lowercase. ICU sentence
  // segmentation can merge such a closing into the preceding sentence.
  const remaining = body
    .split(/(?<=[.!?…])(?=\s)/u)
    .filter((segment) => sentenceKey(segment) !== closingKey)
    .join('')
    .trim();
  if (!remaining)
    throw new Error('Sensory suggestion body must include more than its closing sentence');
  return `${remaining}${/[.!?…]$/.test(remaining) ? '' : '.'} ${closing}`;
}
export function assembleSuggestions(
  input: z.infer<typeof roundContentSchema>,
  context: BodyContext,
) {
  const location = normal(spokenLocation(context.primaryLocation));
  const suggestions = CONTENT_CATEGORIES.flatMap((contentCategory) =>
    DELIVERY_STYLES.map((deliveryStyle) => {
      const body = input[contentCategory][deliveryStyle].trim();
      const closingSentence =
        contentCategory === 'sensory_discriminative'
          ? sensoryClosing(deliveryStyle, context)
          : undefined;
      return {
        type: `${contentCategory}_${deliveryStyle}`,
        contentCategory,
        deliveryStyle,
        targetGoal: input[contentCategory].goal,
        text: closingSentence ? appendClosingOnce(body, closingSentence) : body,
        ...(closingSentence
          ? { closingSentence, generatedBody: body, textAssembly: 'sensory-closing-2' as const }
          : {}),
      };
    }),
  );
  const checked = generatedSchema.parse({ suggestions });
  if (suggestions.some((x) => containsTry(x.text) || containsTry(x.targetGoal)))
    throw new Error('Suggestion contains prohibited wording');
  for (const suggestion of suggestions) {
    const text = normal(input[suggestion.contentCategory][suggestion.deliveryStyle]);
    if (!text.includes(location))
      throw new Error('Every suggestion must name the selected body area');
    if (suggestion.deliveryStyle === 'direct' && !text.startsWith(`your ${location}`))
      throw new Error('Direct suggestions must begin with the selected body area');
    if (
      suggestion.deliveryStyle === 'imagery' &&
      /\b(?:like|as if|as though|compared (?:with|to)|metaphor\w*|symboli\w*|analogy)\b/i.test(text)
    )
      throw new Error('Imagery must describe the literal target experience without comparisons');
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
