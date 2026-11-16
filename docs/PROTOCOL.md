# Suggestion Discovery — current protocol and historical data

## Scope and eligibility

`physical-targets-2x3-v2` is for adults who self-report **current physical pain or an uncomfortable physical sensation**. Emotional distress alone is outside this experience. A separate unchecked eligibility checkbox is required alongside adult/private-invitation confirmation and research consent. The server requires `physicalEligibility:true` and restricts new selections to Physical pain, Other uncomfortable physical sensation, or both. Every selected symptom needs an integer 0–10 baseline rating, with at least one above zero. Check-ins may be zero; no improvement is expected or rewarded.

This is a private technical pilot, not healthcare or an approved public-recruitment study. The application retains its invitation gate and deployment protection. Consent explains coded research use, OpenAI/Supabase/Vercel processing, privacy and voluntary participation. It states that the tool cannot determine whether a symptom is safe or needs care and does not replace medical advice. No diagnostic, medication or treatment instructions are generated. Pause/stop is available at any time; listen seated/stationary in a safe context.

## Six-condition design

Two targets are crossed with three delivery forms, producing six suggestions per round:

| Target                 | Direct                          | Imagery                          | Metaphorical                          |
| ---------------------- | ------------------------------- | -------------------------------- | ------------------------------------- |
| Sensory/discriminative | `sensory_discriminative_direct` | `sensory_discriminative_imagery` | `sensory_discriminative_metaphorical` |
| Affective/motivational | `affective_motivational_direct` | `affective_motivational_imagery` | `affective_motivational_metaphorical` |

Sensory suggestions address qualities such as intensity, spread, boundaries or texture. Affective/motivational suggestions address unpleasantness, emotional response, agency or readiness to respond. These are operational distinctions, not validated mechanisms or perfectly separable processes; evaluate model adherence manually.

Before baseline, participants select one main body area from predefined choices. Associated-feelings options include worry, anxiety, frustration, sadness, anger, helplessness, overwhelm, irritability, tension, discouragement, calm and hopefulness. “None of these” and “Prefer not to say” are exclusive choices. A response is required. Not aware of feelings, None of these and Prefer not to say are mutually exclusive alternatives. No free text is collected. Location and feelings stay fixed within a session; start a new session to change them. These choices are not a validated assessment or a diagnosis, and do not imply feelings cause pain.

OpenAI receives symptoms, body area and disclosed feelings. It returns one shared goal per target and three complete texts per target, requested at 65–90 words and 3–5 sentences. All six texts mention the body area. Direct texts begin “Your [area] …”; imagery begins “Imagine your [area] …”; metaphorical texts make an explicit comparison. Forms are independently worded, not matched direct/permissive pairs. Goals, generation context, exact prompts and final texts are retained. Validation checks six unique texts, area references, required prefixes and prohibited “try” inflections; moderation runs before presentation. Semantic target adherence and shared-goal consistency still require human review. Prompts prohibit guaranteed benefit, diagnosis, declaring symptoms harmless, changing care and unsafe activity.

The server draws uniformly using `crypto.randomInt` from 72 permutations alternating targets. Each of the six conditions appears once. The realised order, algorithm and timestamp are persisted; refresh does not rerandomise. Alternation does not eliminate carryover, expectancy or order effects.

## Listening and measurements

All new rounds use **eyes closed while listening**. Before each recording: one gentle breath at the participant's own pace, press Play, then close eyes. Open eyes immediately after the recording to rate. No automatic next audio or progression occurs.

Current audio protocol `sentence-pauses-v3` synthesizes sentences separately with the same voice/instructions and **0.8× requested speed**. Compatible PCM WAV segments are joined into one file with **three seconds of initial silence** and **four seconds of inserted silence between sentences**, with no added final pause. Provider prosody and natural silences can still vary. Metadata retains voice, model, instructions, requested speed, sentence segments, pause/lead-in lengths, provider IDs, file hash and protocol version. Failed synthesis exposes no partial file.

After each ended event, ask: “How useful was this suggestion in helping you respond to the pain or discomfort in your selected body area?” Explain that usefulness may involve understanding, approaching, managing or relating differently without intensity decreasing. Require integer 0–10 or explicit Unable to rate (`null`); do not preselect. This is an exploratory, unvalidated question. No reward or expected score is shown. The next suggestion becomes available only after the response commits.

After every three **complete six-suggestion rounds (18 suggestions)**, reassess each selected symptom with the same intensity question before another round. Partial/stopped rounds do not count. There is no cap on rounds. Explicit ending records stopped status/end time and preserves partial work. Closing a page leaves its saved session resumable. Client playback events are observations, not proof of attention, eye closure, exposure or honest participation. Native controls allow pausing/seeking; an accessible transcript is available. Accommodations and exclusions need an approved protocol.

## Identity, optional email and storage

A participant UUID links sessions. A separate 256-bit device credential is hashed in `identity_tokens` and stored in an HTTP-only, production-Secure, SameSite=Strict cookie for 30 days. Optional recovery codes are independently generated, shown once and stored only as hashes. Replacing a recovery code invalidates the previous one; sign-out revokes the current device token. No participant email is needed for identity or participation.

Email is offered only after a session ends, with independent consent. AES-256-GCM encrypted addresses live in `email_requests`, apart from research data, and are omitted from exports. Delivery/cancellation clears ciphertext; consent metadata remain. The outbox's atomic pending→sending claim prevents concurrent send/cancel races; uncertain sending requests need investigator reconciliation. See PRIVACY.md for retention, withdrawal and key handling.

| Storage                            | Purpose                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `participants` / `identity_tokens` | ID, recovery hash, hashed device credentials, creation/expiry                |
| `sessions`                         | Owner, version, timestamps and complete versioned study document             |
| `research_events`                  | Event payloads and server timestamps, including client playback observations |
| `email_requests`                   | Separate encrypted optional contact, consent, delivery state                 |
| `rate_limits`                      | Persistent counters keyed by address HMAC or participant/scope hash          |
| private `suggestion-audio` Storage | Generated WAV and historical MP3 assets                                      |

The session document preserves consent/version/time, eligibility confirmation/version/time, selected physical symptoms, baseline/repeated intensity, initial allocation, all ordered rounds, exact prompts/texts/models, shared target goals and generation context, audio metadata, responses and session/round completion. Per-suggestion `contentCategory` and `deliveryStyle` identify the two design dimensions explicitly. CSV exports flatten these fields and preserve missing/unable/zero distinctions.

Server ownership checks are mandatory because the service-role client bypasses RLS. Direct anon/authenticated database access is denied. `commit_session` atomically compares owner/version, updates the document and appends an audit event; stale writes conflict. Generation leases prevent duplicate round creation, and delayed results cannot overwrite a stop. Unique audio paths are removed after failed commits; reconcile orphaned files under the approved retention plan. Very long sessions increase document/write size; load-test realistic pilot lengths.

## Versions and historical compatibility

Current protocol: `physical-targets-2x3-v2`. Consent: `physical-context-consent-2`. Prompt: `physical-target-suggestions-2`. Email consent remains `email-feedback-2`. Audio: `sentence-pauses-v3`.

Earlier records may contain the eleven broad experience choices, five suggestion types, initial open/closed randomisation or fixed eyes-closed rounds, direct/permissive shared bodies, and different audio speed/pause settings. They retain their original protocol, prompts, consent, labels, orders, texts, ratings and recordings. **No existing data are rewritten.** A returning participant with an active earlier-protocol session is prompted to end it and start a new one; the server refuses to generate new rounds for that older session. A new session obtains the new eligibility/consent and fresh baseline.

Historical `suggestion_type` and `paired_instruction_bodies` remain exported. New rows have six-condition IDs plus `content_category`, `delivery_style`, `target_goal`, `target_goals` and `generation_context`; these dimensions are blank for historical rows rather than inferred. Session and round protocol fields allow analysis to distinguish designs. No database migration is needed for this revision: optional new JSON fields use the existing schema. Keep both initial Storage migrations applied.

Do not interpret an intentionally ended session as completion of a prescribed dose. Use round/response completion and partial-round indicators. Neither usefulness scores nor intensity changes establish therapeutic efficacy.

Revision v2 requires duration in the selected body area (Less than 3 months / 3 months or longer) and at least one feelings response, including Not aware of feelings. Consent explains duration collection and OpenAI processing; CSV retains `symptom_duration`. Start a new session; older records remain unchanged. Invalid/truncated model output receives at most one corrective regeneration within bounded provider timeouts; refusal and moderation rejection still fail closed. No database migration is required.
