# Privacy, safety and operational notes

This is a private technical pilot, not a compliance certification. Before inviting testers, the owner/study team must decide the responsible investigator/contact, legal basis, ethics requirements, approved hosting region, processors and cross-border transfers, retention, withdrawal/deletion procedures and incident response. The consent UI directs private testers to their invitation for these details; replace that wording with approved study-specific information before recruitment.

## Boundaries

- No name, date of birth, detailed free text, tracking pixels, advertising identifiers, analytics or browser-side provider keys.
- Selected physical symptom labels, main body area, duration, disclosed sensation qualities and disclosed associated feelings go to OpenAI for text generation; generated text goes to moderation and speech. `store:false` disables Chat Completions storage but does not establish zero provider retention. Review the OpenAI project's actual data controls and contractual terms.
- Supabase stores sensitive research records and private audio. Vercel processes requests and may retain operational/access logs. Review provider defaults and configure minimised logging/retention. The application intentionally logs only safe error categories.
- Cookies: `sd_pilot` (signed, 24h invitation gate) and `sd_identity` (256-bit device token, 30 days). These are necessary sign-in state, not tracking. A session may remain saved beyond cookie expiry under the study's retention plan. The pilot cookie is only one layer; require Vercel deployment protection too.
- Shared pilot invitations limit access but are not individual approvals. Use a separate approved authentication/eligibility process if recruitment needs that level of control.
- Database tables have RLS enabled and no anon/authenticated grants or policies. Functions are SECURITY INVOKER with fixed search paths and restricted execution. The service-role key bypasses RLS; server ownership checks are therefore essential. Keep the key server-side, restrict dashboards and audit access.
- Request rate limits are persistent database counters. Address-based counters store HMACs, not raw IP addresses; they rely on Vercel overwriting forwarded-address headers. A different reverse proxy must strip/spoof-proof these headers. Participant-based generation and audio rate limits provide additional protection. Set provider spend budgets/alerts independently.
- Participation may involve distress. Suggestions have bounded safety prompts and moderation, but generated content can still be inappropriate. Stop is always available. No medical advice or therapeutic efficacy is promised; do not run while driving or in unsafe surroundings. Moderator/provider failures block generation rather than substituting unrecorded content.

## Email data and delivery

Participants are told before starting that coded responses are used for research and that no name or email is required. Email is optional, separately consented, and collected only on the ended-session screen. Leaving the email form blank does not affect participation or saved research responses. It is deliberately **not** the recovery mechanism. Addresses are AES-256-GCM encrypted with a separate server key in `email_requests` and excluded from exports. Linkage to a session means a participant who opts in is not fully anonymous to the authorised system operator. Emails include selected experiences and participation counts; review this sensitive content with testers and the study team before enabling delivery.

A dispatcher claims `pending → sending` atomically before contacting Resend. Cancellation claims only pending requests. This prevents a concurrent dispatcher from sending a cancelled request. The provider request uses a stable per-request idempotency key. Success changes the row to `sent`, records provider ID/time and erases the encrypted address. Pending cancellation changes it to `cancelled` and erases the ciphertext. Consent metadata is retained as an audit record.

On provider/network failure or process termination after claim, a request stays `sending`; the app never automatically re-sends that uncertain request. An investigator must inspect the provider and reconcile delivery before marking sent/erasing ciphertext or deliberately resetting to pending. Resend's idempotency retention is bounded; do not assume a retry days later cannot duplicate delivery. Pending-cancellation controls cannot retract mail already sending/sent; the UI explains that limit. Configure the scheduler only after this operational process is assigned. No scheduler has been enabled by this change.

Key rotation needs an intentional decrypt/re-encrypt migration for pending contacts, or deletion with the study team's approval. Losing the encryption key loses queued address recovery. Do not rotate it blindly. Recovery tokens and cookie secrets have separate functions: rotating `SESSION_SECRET` or invitation code invalidates pilot cookies; changing recovery codes does not revoke existing device tokens. Revoke all a participant's `identity_tokens` through the restricted database if needed after credential loss.

## Retention and withdrawal

Retention is intentionally **not assigned an invented duration**. Decide it before collection, then implement an approved private scheduled cleanup. Until then, only use synthetic data or explicitly authorised private technical testers with agreed arrangements.

The operator must regularly delete expired device tokens and expired rate-limit rows, reconcile orphaned audio files, and delete old research/consent/email records according to the approved schedule. Storage files do not automatically cascade with participant deletion. A withdrawal runbook is:

1. Authenticate the request using the agreed study procedure; a public UUID alone is not sufficient proof of ownership.
2. Locate the participant UUID and all Storage objects under its prefix in `suggestion-audio`; delete those objects using a restricted admin process. Deleting only database rows leaves audio behind.
3. Delete the participant row. Foreign keys cascade sessions, tokens, research events and email requests. Deletion does not recall already delivered email or remove existing exports/backups/provider-held records.
4. Apply the approved handling to investigator extracts, backups and provider retention. Keep an appropriate minimal administrative audit outside the participant export, without reintroducing deleted sensitive data.

For a serious incident, disable the pilot (`PILOT_ENABLED=false` and redeploy), revoke affected credentials, preserve authorised incident evidence, and follow the study/institution's notification procedures. Do not post sensitive incident data to the public GitHub issue tracker.

## Verification limits

A server cannot establish eye closure or attention from browser events. Audio can be paused, sought, muted or inaccessible. The accessible transcript is available, but the current audio experiment requires a completed playback event to rate; a participant unable to listen should stop and contact the study team for an approved accessible protocol rather than fabricate exposure. Define these exclusions/accommodations in the approved protocol.

Native controls, keyboard-operated labelled inputs, explicit scale anchors, non-preselected responses, visible focus, live errors, reduced-motion handling, and responsive layouts are provided. Real assistive-technology testing and real-device audio/content review remain required before recruitment.

The current experience is restricted by self-report to adults with physical pain or uncomfortable physical sensations. Physical eligibility and its timestamp/version are stored with consent. Earlier broader-category records are retained with their original protocol; the update does not convert those into physical-symptom records.

The body-area and optional-feelings choices are stored with the session and exported as coded research context. None/Prefer-not-to-say selections are retained but excluded from the generation prompt. Consent version `physical-context-consent-4` explicitly explains context collection and OpenAI processing. Earlier consent records remain intact.

Revision v2 requires duration in the selected body area (Less than 3 months / 3 months or longer) and at least one feelings response, including Not aware of feelings. Consent explains duration collection and OpenAI processing; CSV retains `symptom_duration`. Start a new session; older records remain unchanged. Invalid/truncated model output receives at most one corrective regeneration within bounded provider timeouts; refusal and moderation rejection still fail closed. No database migration is required.

Resonance revision: participant guidance uses Step 1 through Step 7, with listening/rating repeated for each suggestion. New sessions store `assessment` version `resonance-1`, exact question, explanation, anchors and Unable-to-rate option. Response events use `resonance_response`. Exports add construct/version/question/anchors, `response_value` and `resonance`; the existing `usefulness` column is retained only for historical usefulness records. Earlier sessions, responses and events are not relabelled or rewritten. Start a new session to use resonance; no database migration or credentials are needed.

Sensation-quality setup: before associated feelings, ask “What does the pain or discomfort feel like?” with multiple predefined choices (aching, sharp/stabbing, burning, throbbing, pressure, tightness, pulling, cramping, tingling, numbness, itching, heaviness, tenderness, shooting, or another sensation). At least one response is required; Hard to describe and Prefer not to say are exclusive alternatives. No free text or diagnostic inference is used. `associatedSensations` is stored in the session/round generation context and exported as `associated_sensations`. Disclosed qualities personalise sensory bodies; non-disclosure and Another sensation do not supply an invented quality. Consent explains processing by OpenAI. Existing records remain unchanged; start a new session. No migration or credentials are required.
