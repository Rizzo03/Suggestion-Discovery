# API and research export

All routes are Next.js server route handlers. Responses are `Cache-Control: no-store`; errors contain a safe message. Participant mutation requests require same-origin `Origin` and JSON bodies (except DELETE). Participant credentials use HTTP-only cookies, never a participant ID supplied in a body. UUID ownership is checked for every session access. All participant routes require the private pilot gate; unauthorised investigator routes require an independent bearer token.

| Method / route under `/api`                                                                                                                 | Purpose                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `POST access` `{code}`                                                                                                                      | Verify private invitation; 24h pilot cookie                      |
| `POST identity`                                                                                                                             | New anonymous participant/device token                           |
| `POST recover` `{code}`                                                                                                                     | Reconnect to ID on another device                                |
| `GET me`                                                                                                                                    | ID, recovery availability and latest saved session               |
| `POST recovery`                                                                                                                             | Create/replace optional recovery code; returned once             |
| `POST logout`                                                                                                                               | Revoke current device token and cookie                           |
| `POST sessions` `{experiences,ratings,primaryLocation,symptomDuration,associatedFeelings,consent:true,adult:true,physicalEligibility:true}` | Versioned consent, complete baseline, first allocation           |
| `GET sessions/:id`                                                                                                                          | Owned session state                                              |
| `POST sessions/:id/round`                                                                                                                   | Claim generation lease; create all six texts and persisted order |
| `POST sessions/:id/intensity` `{ratings}`                                                                                                   | Due three-round reassessment only                                |
| `POST sessions/:id/stop`                                                                                                                    | End at any point; idempotent for ended session                   |
| `POST sessions/:id/suggestions/:suggestionId/audio`                                                                                         | Prepare/cache current suggestion speech                          |
| `GET sessions/:id/suggestions/:suggestionId/audio`                                                                                          | Stream private current audio through ownership-checked server    |
| `POST sessions/:id/suggestions/:suggestionId/events`                                                                                        | Playback `event`, `position`, `duration`, ISO `clientAt`         |
| `POST sessions/:id/suggestions/:suggestionId/response` `{value}`                                                                            | Required integer 0–10 or explicit `null` after ended event       |
| `POST sessions/:id/feedback` `{email,consent:true}`                                                                                         | Separate opt-in for ended session; one request/session           |
| `DELETE sessions/:id/feedback`                                                                                                              | Cancel a pending request; erase contact ciphertext               |
| `GET research/export?dataset=...`                                                                                                           | Investigator-only CSV; see below                                 |
| `POST research/send-feedback`                                                                                                               | Investigator-only private outbox dispatch; at most ten items     |

Typical errors: 400 invalid data; 401 missing identity/investigator auth; 403 invalid origin/pilot access; 404 unknown/unowned session; 409 protocol/concurrency conflict; 429 rate limit; 502 provider failure; 503 closed/unconfigured pilot or database problem. Reload saved state after a conflict. The server does not log request bodies, prompts, emails, provider error bodies or secrets.

## CSV export

Call from a secure investigator workstation with `Authorization: Bearer <RESEARCH_EXPORT_TOKEN>`. Do not put the token in a query string. Exports are downloads, not participant-facing links. Prefer a secure API client using a secret variable; avoid shell history or command lines containing a literal token.

Datasets: `sessions`, `suggestions`, `intensity`, `events`.

- `sessions`: IDs, selected experiences, baseline consent, first eye allocation/audit, status, ended timestamp, completed and partial round counts.
- `suggestions`: one row for **every generated suggestion**, including unplayed/unrated suggestions; exact text and prompt; type/position/order, round eye condition, all model/prompt metadata; audio path, SHA-256, model, voice, instructions, lead-in duration and request ID; listening completion, resonance, explicit response status and timestamps.
- `intensity`: one row per experience per measurement, with `after_round=0` for baseline.
- `events`: event ID, participant/session IDs, event name, JSON payload, server timestamp. Playback payloads preserve client time, current position and duration. Randomisation and session events are included too.

`response_status` distinguishes `missing`, `unable_to_rate` and `rated`; numeric zero is retained. Formula-like cells are prefixed with an apostrophe and all cells are CSV quoted to reduce spreadsheet injection. The apostrophe may need removal in analysis tools after safe text import. No email address, recovery hash, sign-in hash, contact key or provider key is exported.

Every request pages over 200 base sessions (or 200 events for the events dataset). The expanded suggestions and intensity datasets may contain more than 200 CSV rows. Continue with `offset` set to `X-Next-Offset` until it is empty. Retain the initial `X-Export-Until` value as the `until` parameter on all subsequent pages/datasets; optional `after` and `until` are ISO timestamps filtering **creation time**. Retain the same filter parameters throughout. Each page has its own header; concatenate CSV data without duplicating headers. An empty page is an empty CSV body.

This endpoint is not a transactionally frozen snapshot across requests: live sessions can change while an export is underway. For a reproducible study extract, stop collection in the protected environment, wait for in-flight operations to settle, export every page and archive the raw datasets with the extraction timestamp/protocol version. Sessions updated after their creation still appear under their creation window; this is not an incremental change feed. Use `research_events` for append-only event history. Backups/extracts need their own approved access and retention controls.

New rounds carry `round_protocol_version=physical-targets-2x3-v3` and `eye_state=closed`. New sessions expose `protocol_version`; historical records without it export as `eyes-comparison-v1`. `audio_lead_in_seconds` is 3 for new WAV recordings and 0 for legacy audio. Playback duration/position includes the silence, so speech-relative analysis should subtract the recorded lead-in.

Current physical-symptom sessions use protocol `physical-targets-2x3-v3`, six suggestions per round and a check-in after 18 suggestions. New-session experience values are Physical pain and Other uncomfortable physical sensation; explicit physical eligibility and at least one positive baseline rating are required. New suggestion export rows include `content_category`, `delivery_style`, `target_goal`, `target_goals` and `generation_context`, alongside the six-condition `suggestion_type`. Historical rows remain unchanged and those new dimensions are blank. See PROTOCOL.md for definitions.

The revised setup requires a predefined main body area and permits associated-feelings responses, including exclusive None/Prefer-not-to-say choices. Session CSV adds `primary_location`, `symptom_duration` and `associated_feelings`. Disclosed context is retained and sent to OpenAI for generation; no feelings are inferred when omitted. Start a new session for this protocol; historical records and audio remain unchanged. No new database migration or credentials are required.

Revision v2 requires duration in the selected body area (Less than 3 months / 3 months or longer) and at least one feelings response, including Not aware of feelings. Consent explains duration collection and OpenAI processing; CSV retains `symptom_duration`. Start a new session; older records remain unchanged. Invalid/truncated model output receives at most one corrective regeneration within bounded provider timeouts; refusal and moderation rejection still fail closed. No database migration is required.

Resonance revision: participant guidance uses Step 1 through Step 7, with listening/rating repeated for each suggestion. New sessions store `assessment` version `resonance-1`, exact question, explanation, anchors and Unable-to-rate option. Response events use `resonance_response`. Exports add construct/version/question/anchors, `response_value` and `resonance`; the existing `usefulness` column is retained only for historical usefulness records. Earlier sessions, responses and events are not relabelled or rewritten. Start a new session to use resonance; no database migration or credentials are needed.
