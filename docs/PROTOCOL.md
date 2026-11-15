# Study protocol and data model

## Participant identity and consent

A random UUID identifies a participant. A separate 256-bit device token is stored in an HTTP-only, SameSite=Strict cookie, Secure in production, for 30 days. Only its SHA-256 hash and expiry are stored in `identity_tokens`. The participant ID is not an authentication secret. Anonymous IDs reduce identification but do not make sensitive research records risk-free.

Optional recovery uses a different 256-bit code shown once, hashed in `participants.recovery_hash`. It is independent of the pilot invitation. Recovery creates a new device token; multiple devices may refer to the same participant. Creating a replacement recovery code invalidates the previous code. Signing out deletes the current device token. Lost IDs cannot be recovered without a recovery code. Do not store recovery codes in research exports.

Research consent is explicitly checked, versioned and timestamped at the start of every session, with adult/private-invitation confirmation. Email consent is an independent event after the session ends. The technical pilot is not prepared for minors or public recruitment.

## Round sequence

1. Choose one or more of the eleven predefined challenging-experience labels; Other has no free text.
2. Submit an integer 0–10 baseline intensity for every selected label. Zero is meaningful. No rating is preselected.
3. Draw first eye condition with `node:crypto.randomInt(2)` and persist the realised allocation and algorithm timestamp in the baseline session document. Alternate subsequent round conditions deterministically. The same first allocation persists across resumed sessions; a new session receives a new allocation.
4. Prepare five texts with unique required types in one structured-output API response. Validate output and screen it with moderation. Fail closed on errors/refusal/flagged content. A safety prompt restricts medical claims, unsafe contexts and coercion. Model-generated safety cannot be guaranteed; review content and provider suitability before recruitment.
5. Shuffle all five types using a fresh Fisher–Yates draw with `crypto.randomInt` on every round. Store realised type order, per-suggestion position, algorithm/timestamp and round eye condition before showing audio. Random draws are not regenerated on refresh. The stored order is the audit record; no shared deterministic seed is used.
6. Show the assigned eye instructions before preparation and with each suggestion. The eye state applies only during listening; closed-eye listeners open their eyes immediately after each recording to rate. Native controls allow pause/seek/replay of the current suggestion. No audio or next suggestion auto-starts.
7. Record client-reported play, pause, seek, error and ended events with position, duration, client timestamp and server timestamp. The server accepts a listening completion only for the current suggestion with prepared audio and an ended position at its reported duration. This is not fraud-resistant exposure verification. Seeking, muted playback, reading transcripts or fabricated clients can invalidate assumptions; use event data for exclusions under an approved analysis plan.
8. After listening completion, require the exact usefulness question and standard explanation. Allow integer 0–10 or explicit `null` for Unable to rate. A missing response differs from unable. The exploratory proposed measure is not presented as validated. Selection may encompass several experiences; the screen reminds participants of all selected labels.
9. Commit each response before exposing the next suggestion. The final response marks a round complete. After each multiple of three complete rounds, collect the same intensity questions for all selected experiences before a subsequent round. A stopped partial round never counts toward this interval.
10. Participants may stop at any point, including while generation is in progress. Closing the page leaves an unfinished session resumable; it does not falsely mark it completed. Explicit end records `status=stopped` and `endedAt`, preserves partial work and clears generation leases. There is no cap on rounds or required improvement. Existing complete responses remain saved if the next operation fails.

## Storage and concurrency

| Table                  | Purpose                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `participants`         | Participant UUID, optional recovery hash, creation timestamp                               |
| `identity_tokens`      | Hashed device credentials and expiry, never exported                                       |
| `sessions`             | Participant ownership, creation/update timestamps, CAS version and versioned `state` JSONB |
| `research_events`      | Append-only application event stream: session, participant, event payload, server time     |
| `email_requests`       | Separate encrypted email, session linkage, explicit consent version/time, delivery status  |
| `rate_limits`          | Bounded time-window counters keyed by HMAC of address/scope or hashed participant/scope    |
| private Storage bucket | Persisted generated MP3 files under participant/session/suggestion/random-asset prefixes   |

The study document contains selected experiences; baseline and repeated measurements; consent; initial allocation; complete ordered rounds; exact text, prompt and AI metadata; audio path/hash/request metadata; each usefulness response and timestamp; and completion information. This deliberately uses one transactional document per session rather than duplicated normalised rating rows. CSV exports flatten it into analysis tables. Very long sessions increase document size and CAS-write cost; load-test realistic pilot lengths before enabling participants at scale. No artificial session-round limit is imposed.

`commit_session` compares participant ownership and expected version, updates state and appends its audit event in one PostgreSQL transaction. A stale writer receives a conflict. Active sessions are unique per participant. A round-generation lease prevents duplicate generation; a crashed lease can be retried after five minutes. A late generation cannot overwrite a stop or other version change. Audio assets use unique paths and are deleted on failed state commit. An upload completed just before process termination may be orphaned; an investigator must reconcile Storage prefixes with retained `audioPath` records under the approved retention plan.

Prompt version: `suggestions-1`. Consent version: `pilot-consent-1`. Email consent: `email-feedback-1`. Changes to content, voice, allocation or measures should increment the relevant protocol version and be reviewed. Keep model and voice environment variables fixed during a pilot cohort; metadata records the requested model and voice for every generated audio file. The Speech API does not guarantee a model build identifier or byte-identical regeneration. Retain the generated audio and SHA-256 hash for audit.

## Session completion and interpretation

An intentionally ended session has `session_complete=true` in the sessions export. This means the participant ended the session, not that a prescribed dose was completed. Use `rounds_complete`, `partial_round`, individual response statuses and completion timestamps in analysis. Inactive-but-unended sessions remain `active`; do not infer exposure or completion from page visits. Neither usefulness ratings nor intensity changes establish therapeutic efficacy.
