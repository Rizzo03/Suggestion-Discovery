import { describe, it, expect } from 'vitest';
import { zodResponseFormat } from 'openai/helpers/zod';
import { assembleSuggestions, containsTry, roundContentSchema } from '../lib/suggestion-content';
const fixture = () => ({
  pairedInstructions: [
    'notice the support beneath your feet and the contact between your body and the chair, letting your attention rest there for a moment',
    'allow the experience you selected to be present as you notice one ordinary sound nearby, without needing it to become different',
    'choose a small next step that feels manageable, keeping the option to pause or stop whenever you wish',
  ],
  metaphor:
    'Picture your experience as a bag beside your chair. You can notice its presence without lifting it for a moment. The bag does not need to disappear for you to look around the room.',
  imagery:
    'Imagine an ordinary quiet room with a comfortable chair. Notice the light on a nearby wall and the space around the chair. You can leave this scene whenever you wish.',
  attentional_shift:
    'Notice one sound in the room, then the feeling of the chair beneath you. Your chosen experience can remain present while you notice these other parts of this moment.',
});
describe('matched suggestion content', () => {
  it('preserves byte-identical instruction bodies and order, changing only the delivery prefix', () => {
    const input = fixture();
    const result = assembleSuggestions(input);
    const direct = result.suggestions.find((x) => x.type === 'direct')!.text;
    const permissive = result.suggestions.find((x) => x.type === 'permissive')!.text;
    expect(direct).toBe(input.pairedInstructions.map((body) => `Now, ${body}.`).join(' '));
    expect(permissive).toBe(
      input.pairedInstructions.map((body) => `Invite yourself to ${body}.`).join(' '),
    );
    expect(direct.replace(/(?:^|(?<=\. ))Now, /g, '')).toBe(
      permissive.replace(/(?:^|(?<=\. ))Invite yourself to /g, ''),
    );
    expect(result.pairedInstructionBodies).toEqual(input.pairedInstructions);
    expect(new Set(result.suggestions.map((x) => x.type)).size).toBe(5);
  });
  it('rejects prohibited wording across every type and the shared bodies', () => {
    for (const field of ['metaphor', 'imagery', 'attentional_shift'] as const) {
      const input = fixture();
      input[field] += ' Try noticing this.';
      expect(() => assembleSuggestions(input)).toThrow(/prohibited/);
    }
    const input = fixture();
    input.pairedInstructions[0] = 'try noticing the support of the chair';
    expect(() => assembleSuggestions(input)).toThrow(/prohibited/);
    for (const word of ['try', 'TRY', 'trying', 'tried', 'tries', 'ＴＲＹ'])
      expect(containsTry(word)).toBe(true);
    expect(containsTry('Notice the geometry of the room and a nearby tree.')).toBe(false);
  });
  it('rejects malformed shared bodies rather than generating mismatched sentences', () => {
    for (const body of [
      'Notice the chair beneath you',
      ' notice the chair beneath you',
      'notice the chair beneath you.',
      'notice the chair\nthen stop',
    ]) {
      const input = fixture();
      input.pairedInstructions[0] = body;
      expect(() => assembleSuggestions(input)).toThrow();
    }
  });
  it('can produce a strict structured-output schema supported by the installed OpenAI SDK', () => {
    const format = zodResponseFormat(roundContentSchema, 'suggestion_round');
    expect(format.type).toBe('json_schema');
    expect(format.json_schema.strict).toBe(true);
    expect(format.json_schema.schema?.required).toEqual(
      expect.arrayContaining(['pairedInstructions', 'metaphor', 'imagery', 'attentional_shift']),
    );
  });
});
