import { PILOT_PROFILE } from './pilot';
import { Session, TYPES } from './study';
import { meetsTextPolicy } from './text-policy';
export type AnalysisWindow = 'primary' | 'all';
const quantile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    index = (sorted.length - 1) * p,
    lo = Math.floor(index);
  return sorted[lo] + (sorted[Math.ceil(index)] - sorted[lo]) * (index - lo);
};
export function durationSummary(values: number[]) {
  return {
    n: values.length,
    min: values.length ? values.reduce((a, b) => Math.min(a, b), Infinity) : null,
    p25: quantile(values, 0.25),
    median: quantile(values, 0.5),
    p75: quantile(values, 0.75),
    max: values.length ? values.reduce((a, b) => Math.max(a, b), -Infinity) : null,
  };
}
export function isPilotSession(session: Session) {
  return (
    session.state.pilot?.pilotVersion === PILOT_PROFILE.pilotVersion &&
    session.state.protocolVersion === PILOT_PROFILE.protocolVersion &&
    session.state.assessment?.construct === 'resonance' &&
    session.state.assessment.version === PILOT_PROFILE.assessmentVersion
  );
}
/** Identify first eligible sessions globally, before filtering rounds or outcomes. */
export function primarySessionIds(sessions: Session[]) {
  const first = new Map<string, string>();
  for (const session of [...sessions]
    .filter(isPilotSession)
    .sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id),
    ))
    if (!first.has(session.participant_id)) first.set(session.participant_id, session.id);
  return new Set(first.values());
}
export function qualitySummary(sessions: Session[], window: AnalysisWindow = 'primary') {
  const primary = primarySessionIds(sessions),
    eligible = sessions.filter(isPilotSession);
  const selected = window === 'primary' ? eligible.filter((s) => primary.has(s.id)) : eligible;
  const versions = new Map<
    string,
    { pilot: string; protocol: string; measure: string; sessions: number; rounds: number }
  >();
  for (const s of sessions) {
    const pilot = s.state.pilot?.pilotVersion ?? 'development/legacy',
      protocol = s.state.protocolVersion ?? 'eyes-comparison-v1',
      measure = s.state.assessment?.construct ?? 'usefulness',
      key = JSON.stringify([pilot, protocol, measure]);
    const row = versions.get(key) ?? { pilot, protocol, measure, sessions: 0, rounds: 0 };
    row.sessions++;
    row.rounds += s.state.rounds.length;
    versions.set(key, row);
  }
  const cells = TYPES.map((type) => ({
    type,
    generated: 0,
    prepared: 0,
    heard: 0,
    rated: 0,
    unable: 0,
    missing: 0,
    invalid: 0,
    zero: 0,
    distribution: Array(11).fill(0) as number[],
    durations: [] as number[],
    people: new Map<string, number[]>(),
  }));
  const models = new Map<
    string,
    { text: string; audio: string; voice: string; suggestions: number }
  >();
  const flags = {
    incompatibleRounds: 0,
    roundIntegrity: 0,
    completionMismatch: 0,
    multipleModelConfigurations: 0,
    resolvedTextModelVariants: 0,
    unknownTypes: 0,
    textPolicy: 0,
    repeatedSentences: 0,
    durationOutOfRange: 0,
    preparedWithoutDuration: 0,
    invalidResponses: 0,
    modelConfigurationChanges: 0,
    audioProtocolMismatch: 0,
  };
  const configurations = new Set(selected.map((s) => JSON.stringify(s.state.pilot?.models)));
  flags.multipleModelConfigurations = configurations.size > 1 ? configurations.size : 0;
  let completeRounds = 0,
    partialRounds = 0;
  for (const s of selected)
    for (const r of s.state.rounds) {
      if (window === 'primary' && r.number > PILOT_PROFILE.primaryWindow.maxRound) continue;
      if (
        r.pilotVersion !== PILOT_PROFILE.pilotVersion ||
        r.protocolVersion !== PILOT_PROFILE.protocolVersion ||
        r.promptVersion !== PILOT_PROFILE.promptVersion ||
        r.textPolicyVersion !== PILOT_PROFILE.textPolicy.version
      ) {
        flags.incompatibleRounds++;
        continue;
      }
      if (
        r.order.length !== TYPES.length ||
        new Set(r.order).size !== TYPES.length ||
        r.suggestions.length !== TYPES.length ||
        r.order.some(
          (type, i) =>
            !TYPES.includes(type as (typeof TYPES)[number]) ||
            r.suggestions[i]?.type !== type ||
            r.suggestions[i]?.position !== i + 1 ||
            (i > 0 &&
              type.replace(/_(direct|imagery|metaphorical)$/, '') ===
                r.order[i - 1].replace(/_(direct|imagery|metaphorical)$/, '')),
        )
      )
        flags.roundIntegrity++;
      if (Boolean(r.completedAt) !== r.suggestions.every((x) => Boolean(x.response)))
        flags.completionMismatch++;
      if (r.completedAt) completeRounds++;
      else partialRounds++;
      for (const x of r.suggestions) {
        const cell = cells.find((c) => c.type === x.type);
        if (!cell) {
          flags.unknownTypes++;
          continue;
        }
        cell.generated++;
        if (x.audioPath) cell.prepared++;
        if (x.heardAt) cell.heard++;
        const modelKey = JSON.stringify([
          r.model,
          x.audioModel ?? 'not prepared',
          x.voice ?? 'not prepared',
        ]);
        const model = models.get(modelKey) ?? {
          text: r.model,
          audio: x.audioModel ?? 'not prepared',
          voice: x.voice ?? 'not prepared',
          suggestions: 0,
        };
        model.suggestions++;
        models.set(modelKey, model);
        if (!meetsTextPolicy(x.text)) flags.textPolicy++;
        const sentences = [
          ...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(x.text),
        ].map((s) =>
          s.segment
            .toLowerCase()
            .replace(/[.!?…]+\s*$/u, '')
            .replace(/\s+/g, ' ')
            .trim(),
        );
        if (new Set(sentences).size < sentences.length) flags.repeatedSentences++;
        if (x.audioPath) {
          if (
            typeof x.audioDurationSeconds === 'number' &&
            Number.isFinite(x.audioDurationSeconds) &&
            x.audioDurationSeconds > 0
          ) {
            cell.durations.push(x.audioDurationSeconds);
            if (
              x.audioDurationSeconds < PILOT_PROFILE.audioPolicy.targetMinSeconds ||
              x.audioDurationSeconds > PILOT_PROFILE.audioPolicy.targetMaxSeconds
            )
              flags.durationOutOfRange++;
          } else flags.preparedWithoutDuration++;
          if (x.audioProtocolVersion !== PILOT_PROFILE.audioPolicy.version)
            flags.audioProtocolMismatch++;
          if (
            x.audioModel !== s.state.pilot?.models.audio &&
            !(x.audioModel ?? '').startsWith(`${s.state.pilot?.models.audio}-`)
          )
            flags.modelConfigurationChanges++;
          if (x.voice !== s.state.pilot?.models.voice) flags.modelConfigurationChanges++;
        }
        if (
          r.model !== s.state.pilot?.models.text &&
          !r.model.startsWith(`${s.state.pilot?.models.text}-`)
        )
          flags.modelConfigurationChanges++;
        if (!x.response) {
          cell.missing++;
          continue;
        }
        const measure = x.response.measure ?? s.state.assessment?.construct,
          value = x.response.value;
        if (
          measure !== 'resonance' ||
          (value !== null && (!Number.isInteger(value) || value < 0 || value > 10))
        ) {
          cell.invalid++;
          flags.invalidResponses++;
          continue;
        }
        if (value === null) {
          cell.unable++;
          continue;
        }
        cell.rated++;
        if (value === 0) cell.zero++;
        cell.distribution[value]++;
        const values = cell.people.get(s.participant_id) ?? [];
        values.push(value);
        cell.people.set(s.participant_id, values);
      }
    }
  const rows = cells.map(({ people, durations, ...cell }) => {
    const means = [...people.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length);
    return {
      ...cell,
      participantIds: people.size,
      participantBalancedMean: means.length
        ? means.reduce((a, b) => a + b, 0) / means.length
        : null,
      duration: durationSummary(durations),
    };
  });
  const resolved = new Set([...models.values()].map((m) => m.text));
  flags.resolvedTextModelVariants = resolved.size > 1 ? resolved.size : 0;
  return {
    pilot: PILOT_PROFILE,
    window,
    counts: {
      scannedSessions: sessions.length,
      eligibleSessions: eligible.length,
      selectedSessions: selected.length,
      participantIds: new Set(selected.map((s) => s.participant_id)).size,
      endedSessions: selected.filter((s) => s.state.status === 'stopped').length,
      activeSessions: selected.filter((s) => s.state.status === 'active').length,
      completeRounds,
      partialRounds,
      generated: rows.reduce((n, r) => n + r.generated, 0),
      rated: rows.reduce((n, r) => n + r.rated, 0),
      unable: rows.reduce((n, r) => n + r.unable, 0),
      missing: rows.reduce((n, r) => n + r.missing, 0),
    },
    cells: rows,
    versions: [...versions.values()],
    models: [...models.values()],
    flags,
  };
}
export type QualitySummary = ReturnType<typeof qualitySummary>;
export type QualityReport = QualitySummary & {
  generatedAt: string;
  cutoff: string;
  truncated: boolean;
  scanLimit: number;
};
