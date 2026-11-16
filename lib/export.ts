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
    primary_location: s.state.primaryLocation,
    symptom_duration: s.state.symptomDuration,
    associated_feelings: s.state.associatedFeelings,
    associated_sensations: s.state.associatedSensations,
    assessment_construct: s.state.assessment?.construct ?? 'usefulness',
    assessment_version: s.state.assessment?.version,
    assessment_question: s.state.assessment?.question,
    assessment_anchors: s.state.assessment?.anchors,
    consent_version: s.state.consentVersion,
    consent_at: s.state.consentAt,
    eligibility: s.state.eligibility,
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
        content_category: x.contentCategory,
        delivery_style: x.deliveryStyle,
        target_goal: x.targetGoal,
        target_goals: r.targetGoals,
        generation_context: r.generationContext,
        exact_text: x.text,
        generated_body: x.generatedBody,
        closing_sentence: x.closingSentence,
        text_assembly: x.textAssembly,
        model: r.model,
        prompt_version: r.promptVersion,
        paired_instruction_bodies: r.pairedInstructionBodies,
        instruction_pairs: r.instructionPairs,
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
        audio_end_cue: x.audioEndCue,
        audio_pause_seconds: x.audioPauseSeconds ?? 0,
        audio_speed: x.audioSpeed ?? 1,
        audio_segments: x.audioSegments,
        audio_request_ids: x.audioRequestIds,
        audio_protocol_version: x.audioProtocolVersion ?? 'legacy',
        heard_at: x.heardAt,
        response_status: !x.response
          ? 'missing'
          : x.response.value === null
            ? 'unable_to_rate'
            : 'rated',
        assessment_construct: x.response?.measure ?? s.state.assessment?.construct ?? 'usefulness',
        assessment_version: x.response?.measureVersion ?? s.state.assessment?.version,
        assessment_question: s.state.assessment?.question,
        assessment_help: s.state.assessment?.help,
        assessment_anchors: s.state.assessment?.anchors,
        response_value: x.response?.value,
        resonance:
          (x.response?.measure ?? s.state.assessment?.construct) === 'resonance'
            ? x.response?.value
            : undefined,
        usefulness:
          (x.response?.measure ?? s.state.assessment?.construct ?? 'usefulness') === 'usefulness'
            ? x.response?.value
            : undefined,
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
