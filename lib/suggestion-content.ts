import { z } from 'zod';
import { CONTENT_CATEGORIES, DeliveryStyle, generatedSchema } from './study';
// Each content family has one set of instruction bodies. Only its style prefix changes.
const instructionList = z.array(z.string().min(10).max(500)).min(3).max(5);
export const roundContentSchema = z.object({
  external_attention: instructionList,
  imagery: instructionList,
  metaphorical_reframing: instructionList,
});
export function containsTry(text: string) {
  return /\b(?:try|tries|tried|trying)\b/i.test(text.normalize('NFKC'));
}
export function assembleSuggestions(input: z.infer<typeof roundContentSchema>) {
  const suggestions = CONTENT_CATEGORIES.flatMap((contentCategory) => {
    const bodies = input[contentCategory];
    if (
      bodies.some((body) => body !== body.trim() || !/^[a-z]/.test(body) || /[.!?\r\n]/.test(body))
    )
      throw new Error(
        'Shared instructions must be lowercase verb phrases without terminal punctuation',
      );
    return (['direct', 'permissive'] as DeliveryStyle[]).map((deliveryStyle) => ({
      type: `${contentCategory}_${deliveryStyle}`,
      contentCategory,
      deliveryStyle,
      text: bodies
        .map((body) => `${deliveryStyle === 'direct' ? 'Now, ' : 'Invite yourself to '}${body}.`)
        .join(' '),
    }));
  });
  const checked = generatedSchema.parse({ suggestions });
  if (checked.suggestions.some((x) => containsTry(x.text)))
    throw new Error('Suggestion contains prohibited wording');
  return {
    suggestions: suggestions.map((x, i) => ({ ...x, type: checked.suggestions[i].type })),
    instructionPairs: structuredClone(input),
  };
}
