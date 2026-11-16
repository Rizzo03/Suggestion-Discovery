import { z } from 'zod';
import { generatedSchema } from './study';

// The model writes the shared instruction bodies once. The application changes
// only the delivery prefix, so instruction content/order cannot drift between styles.
export const roundContentSchema = z.object({
  pairedInstructions: z.array(z.string().min(10).max(500)).min(3).max(5),
  metaphor: z.string().min(60).max(1800),
  imagery: z.string().min(60).max(1800),
  attentional_shift: z.string().min(60).max(1800),
});
export function containsTry(text: string) {
  return /\b(?:try|tries|tried|trying)\b/i.test(text.normalize('NFKC'));
}
export function assembleSuggestions(input: z.infer<typeof roundContentSchema>) {
  const bodies = input.pairedInstructions;
  if (
    bodies.some((body) => body !== body.trim() || !/^[a-z]/.test(body) || /[.!?\r\n]/.test(body))
  ) {
    throw new Error(
      'Shared instructions must be lowercase verb phrases without terminal punctuation',
    );
  }
  const direct = bodies.map((body) => `Now, ${body}.`).join(' ');
  const permissive = bodies.map((body) => `Invite yourself to ${body}.`).join(' ');
  const result = generatedSchema.parse({
    suggestions: [
      { type: 'metaphor', text: input.metaphor },
      { type: 'permissive', text: permissive },
      { type: 'direct', text: direct },
      { type: 'imagery', text: input.imagery },
      { type: 'attentional_shift', text: input.attentional_shift },
    ],
  });
  if (result.suggestions.some((suggestion) => containsTry(suggestion.text))) {
    throw new Error('Suggestion contains prohibited wording');
  }
  return { suggestions: result.suggestions, pairedInstructionBodies: [...bodies] };
}
