import { it, expect } from 'vitest';
import { RESONANCE_ASSESSMENT, respond, Session, TYPES } from '../lib/study';
import { sessionRows, suggestionRows } from '../lib/export';
import { fixture } from './fixtures';
const at = '2026-11-16T12:00:00.000Z';
function sample(): Session {
  const state = fixture();
  state.rounds = [
    {
      id: 'round',
      number: 1,
      eye: 'closed',
      order: [...TYPES],
      randomisation: { algorithm: 'test', at },
      model: 'test',
      promptVersion: 'test',
      prompt: 'test',
      responseId: 'test',
      createdAt: at,
      suggestions: TYPES.map((type, i) => ({
        id: `s${i}`,
        type,
        position: i + 1,
        text: 'test',
        heardAt: at,
      })),
    },
  ];
  return { id: 'session', participant_id: 'participant', created_at: at, version: 1, state };
}
it('records the resonance construct, exact question and anchors, preserving zero, unable and missing', () => {
  const session = sample();
  session.state = respond(session.state, 's0', 0, at);
  session.state = respond(session.state, 's1', null, at);
  expect(session.state.rounds[0].suggestions[0].response).toMatchObject({
    value: 0,
    measure: 'resonance',
    measureVersion: 'resonance-1',
  });
  const rows = suggestionRows([session]);
  expect(rows[0]).toMatchObject({
    resonance: 0,
    assessment_construct: 'resonance',
    assessment_question: RESONANCE_ASSESSMENT.question,
    assessment_anchors: { zero: 'Not at all', ten: 'Very much' },
    response_status: 'rated',
  });
  expect(rows[0].usefulness).toBeUndefined();
  expect(rows[1]).toMatchObject({ resonance: null, response_status: 'unable_to_rate' });
  expect(rows[2]).toMatchObject({ response_status: 'missing' });
  expect(rows[2].resonance).toBeUndefined();
  expect(sessionRows([session])[0].assessment_version).toBe('resonance-1');
});
it('keeps historical usefulness data separate without inferring a new question or rewriting records', () => {
  const session = sample();
  delete session.state.assessment;
  session.state.protocolVersion = 'physical-targets-2x3-v2';
  session.state.rounds[0].suggestions[0].response = { value: 7, at };
  const before = structuredClone(session);
  const row = suggestionRows([session])[0];
  expect(row).toMatchObject({ usefulness: 7, assessment_construct: 'usefulness' });
  expect(row.resonance).toBeUndefined();
  expect(row.assessment_question).toBeUndefined();
  expect(session).toEqual(before);
  session.state = respond(session.state, 's1', null, at);
  expect(session.state.rounds[0].suggestions[1].response?.measure).toBe('usefulness');
});
