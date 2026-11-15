import { Session } from './study';
export function sessionRows(sessions: Session[]) {
  return sessions.map((s) => ({
    participant_id: s.participant_id,
    session_id: s.id,
    protocol_version: s.state.protocolVersion ?? 'eyes-comparison-v1',
    created_at: s.created_at,
    status: s.state.status,
    ended_at: s.state.endedAt,
    session_complete: s.state.status === 'stopped',
    rounds_complete: s.state.rounds.filter((r) => r.completedAt).length,
    partial_round: s.state.rounds.some((r) => !r.completedAt),
    selected_experiences: s.state.experiences,
    consent_version: s.state.consentVersion,
    consent_at: s.state.consentAt,
    first_eye: s.state.firstEye,
    allocation: s.state.allocation,
  }));
}
export function suggestionRows(sessions: Session[]) {
  return sessions.flatMap((s) =>
    s.state.rounds.flatMap((r) =>
      r.suggestions.map((x) => ({
        participant_id: s.participant_id,
        session_id: s.id,
        round_id: r.id,
        round_protocol_version: r.protocolVersion ?? 'eyes-comparison-v1',
        round_number: r.number,
        round_complete: !!r.completedAt,
        round_completed_at: r.completedAt,
        eye_state: r.eye,
        randomisation: r.randomisation,
        order: r.order,
        position: x.position,
        suggestion_id: x.id,
        suggestion_type: x.type,
        exact_text: x.text,
        model: r.model,
        prompt_version: r.promptVersion,
        exact_prompt: r.prompt,
        response_id: r.responseId,
        generated_at: r.createdAt,
        audio_path: x.audioPath,
        audio_sha256: x.audioSha256,
        audio_model: x.audioModel,
        voice: x.voice,
        voice_instructions: x.voiceInstructions,
        audio_created_at: x.audioCreatedAt,
        audio_request_id: x.audioRequestId,
        audio_lead_in_seconds: x.audioLeadInSeconds ?? 0,
        heard_at: x.heardAt,
        response_status: !x.response
          ? 'missing'
          : x.response.value === null
            ? 'unable_to_rate'
            : 'rated',
        usefulness: x.response?.value,
        response_at: x.response?.at,
      })),
    ),
  );
}
export function intensityRows(sessions: Session[]) {
  return sessions.flatMap((s) =>
    [{ afterRound: 0, ...s.state.baseline }, ...s.state.reassessments].flatMap((m) =>
      Object.entries(m.ratings).map(([experience, intensity]) => ({
        participant_id: s.participant_id,
        session_id: s.id,
        after_round: m.afterRound,
        experience,
        intensity,
        recorded_at: m.at,
      })),
    ),
  );
}
