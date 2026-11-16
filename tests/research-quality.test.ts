import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fixture } from './fixtures';
import { assembleSuggestions } from '../lib/suggestion-content';
import { contentFixture, sampleContext } from './content-fixture';
import { PILOT_PROFILE } from '../lib/pilot';
import { qualitySummary, primarySessionIds } from '../lib/research-quality';
import { csv, Session, TYPES } from '../lib/study';
import { suggestionOrder } from '../lib/order';
import { sessionRows, suggestionRows } from '../lib/export';
const at = '2026-11-16T00:00:00.000Z';
function sample(
  person: string,
  id: string,
  day: number,
  rounds = 1,
  value: number | null | undefined = undefined,
): Session {
  const state = fixture(),
    texts = assembleSuggestions(contentFixture(), sampleContext).suggestions;
  state.rounds = Array.from({ length: rounds }, (_, i) => {
    const order = suggestionOrder(() => 0);
    return {
      id: `${id}-r${i + 1}`,
      number: i + 1,
      eye: 'closed' as const,
      pilotVersion: PILOT_PROFILE.pilotVersion,
      protocolVersion: PILOT_PROFILE.protocolVersion,
      textPolicyVersion: PILOT_PROFILE.textPolicy.version,
      order,
      randomisation: { algorithm: 'test', at },
      model: 'gpt-4.1-mini',
      promptVersion: PILOT_PROFILE.promptVersion,
      prompt: 'test',
      responseId: 'test',
      createdAt: at,
      suggestions: order.map((type, j) => ({
        ...texts.find((x) => x.type === type)!,
        id: `${id}-${i}-${j}`,
        position: j + 1,
        audioPath: 'private',
        audioDurationSeconds: 60,
        audioModel: 'gpt-4o-mini-tts',
        voice: 'coral',
        audioProtocolVersion: PILOT_PROFILE.audioPolicy.version,
        ...(type === TYPES[0] && value !== undefined
          ? { heardAt: at, response: { value, at, measure: 'resonance' as const } }
          : {}),
      })),
    };
  });
  return {
    id,
    participant_id: person,
    created_at: `2026-11-${String(day).padStart(2, '0')}T00:00:00.000Z`,
    state,
    version: 1,
  };
}
it('uses the earliest eligible session including partial work, and balances participants rather than ratings', () => {
  const a = sample('a', 'first', 16, 4, 0),
    later = sample('a', 'later', 17, 1, 10),
    b = sample('b', 'b', 17, 1, 10),
    old = sample('c', 'legacy', 15, 1, 10);
  delete old.state.pilot;
  delete old.state.assessment;
  old.state.protocolVersion = 'legacy';
  const input = [later, b, old, a],
    before = structuredClone(input);
  expect([...primarySessionIds(input)]).toEqual(['first', 'b']);
  const report = qualitySummary(input);
  expect(report.counts.selectedSessions).toBe(2);
  expect(report.counts.participantIds).toBe(2);
  expect(report.counts.generated).toBe(24);
  expect(report.cells.find((x) => x.type === TYPES[0])).toMatchObject({
    rated: 4,
    zero: 3,
    participantIds: 2,
    participantBalancedMean: 5,
  });
  expect(report.versions.find((v) => v.protocol === 'legacy')?.measure).toBe('usefulness');
  expect(qualitySummary(input, 'all').cells.find((x) => x.type === TYPES[0])?.rated).toBe(6);
  expect(input).toEqual(before);
  // No coded individual identifiers or raw health text are returned to the browser.
  expect(Object.keys(report)).not.toContain('sessions');
  expect(JSON.stringify(report)).not.toContain('participant_id');
});
it('keeps unable, zero, missing and invalid separate and flags quality problems without dropping ratings', () => {
  const s = sample('a', 'one', 16, 1, 0),
    second = s.state.rounds[0].suggestions.find((x) => x.type === TYPES[1])!;
  second.response = { value: null, at, measure: 'resonance' };
  second.audioDurationSeconds = 90;
  const third = s.state.rounds[0].suggestions.find((x) => x.type === TYPES[2])!;
  delete third.audioDurationSeconds;
  const fourth = s.state.rounds[0].suggestions.find((x) => x.type === TYPES[3])!;
  fourth.response = { value: 5, at, measure: 'usefulness' };
  const first = s.state.rounds[0].suggestions.find((x) => x.type === TYPES[0])!;
  first.text += ' Repeated sentence. Repeated sentence.';
  const report = qualitySummary([s]);
  expect(report.counts).toMatchObject({ rated: 1, unable: 1, missing: 3, partialRounds: 1 });
  expect(report.flags).toMatchObject({
    invalidResponses: 1,
    durationOutOfRange: 1,
    preparedWithoutDuration: 1,
    textPolicy: 1,
    repeatedSentences: 1,
  });
  expect(report.cells.find((x) => x.type === TYPES[0])?.participantBalancedMean).toBe(0);
  expect(report.cells.find((x) => x.type === TYPES[2])?.duration.n).toBe(0);
});
it('does not substitute a later completed session when the first has no outcomes, and does not pool incompatible prompts', () => {
  const first = sample('a', 'empty', 16, 0),
    later = sample('a', 'later', 17, 1, 10),
    bad = sample('b', 'bad', 17, 1, 10);
  bad.state.rounds[0].promptVersion = 'different';
  const result = qualitySummary([later, first, bad]);
  expect(result.counts.rated).toBe(0);
  expect(result.flags.incompatibleRounds).toBe(1);
  expect(
    qualitySummary([]).cells.every(
      (x) => x.participantBalancedMean === null && x.duration.median === null,
    ),
  ).toBe(true);
});
it('exports the cohort, text and duration metadata needed for a reproducible offline extract', () => {
  const s = sample('a', 'one', 16);
  const row = suggestionRows([s])[0];
  expect(sessionRows([s])[0].pilot_version).toBe('pilot-1.0');
  expect(sessionRows([s])[0].protocol_snapshot).toEqual(s.state.pilot);
  expect(row).toMatchObject({
    pilot_version: 'pilot-1.0',
    text_policy_version: 'balanced-text-1',
    text_sentence_count: 4,
    audio_duration_seconds: 60,
    analysis_round_window: 'first_three_rounds',
  });
});
it('prepares a seeded balanced review sample, keeping assigned labels in a separate key', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sd-review-'));
  try {
    const rows = suggestionRows([sample('a', 'one', 16, 2)]),
      file = path.join(dir, 'suggestions.csv');
    writeFileSync(file, csv(rows));
    const run = (name: string) =>
      execFileSync(
        'python3',
        [
          'scripts/prepare_review.py',
          '--suggestions',
          file,
          '--out',
          path.join(dir, name),
          '--per-cell',
          '1',
        ],
        { encoding: 'utf8' },
      );
    run('a');
    run('b');
    const a = readFileSync(path.join(dir, 'a/content_review.csv'), 'utf8');
    expect(a).toBe(readFileSync(path.join(dir, 'b/content_review.csv'), 'utf8'));
    expect(a.split('\n')[0]).not.toContain('assigned');
    expect(a.split('\n')[0]).not.toContain('suggestion_type');
    const manifest = JSON.parse(readFileSync(path.join(dir, 'a/review_manifest.json'), 'utf8'));
    expect(manifest.selected).toBe(6);
    expect(Object.values(manifest.selected_by_cell)).toEqual([1, 1, 1, 1, 1, 1]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
