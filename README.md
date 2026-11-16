# Suggestion Discovery Lab

An invitation-only, mobile-friendly listening platform for **adults currently experiencing physical pain or an uncomfortable physical sensation**. Next.js, TypeScript, Supabase and OpenAI; hosted as a protected Vercel technical pilot. Not treatment and not approved for public recruitment. No therapeutic efficacy or measure-validation claims.

Developed by **Dr Rod Rizzo — Pain Scientist — Centre for Pain IMPACT, Neuroscience Research Australia**. Contact: [r.rizzo@neura.edu.au](mailto:r.rizzo@neura.edu.au).

## Current participant flow

1. Create a random participant ID or optionally recover an earlier ID. No name or email required.
2. Read the coded-data research information and separately confirm adult/private-invitation eligibility, current physical symptoms and research consent.
3. Select **Physical pain**, **Other uncomfortable physical sensation**, or both; rate each on 0–10. At least one selected symptom must have a baseline intensity above zero. Subsequent measurements may be zero.
4. Listen with eyes closed to **six suggestions per round**: two targets × three delivery forms.
5. After each recording, open eyes and submit a required 0–10 resonance response or Unable to rate before the next suggestion becomes available.
6. Reassess every selected physical symptom after three complete rounds (**18 suggestions**), before continuing. Stop at any point or continue without a round-count ceiling.
7. Optionally request one separately consented feedback email after ending a session.

| Target                                                                    | Delivery forms                |
| ------------------------------------------------------------------------- | ----------------------------- |
| Sensory/discriminative: qualities of sensations in the selected body area | Direct, Imagery, Metaphorical |
| Affective/motivational: unpleasantness, emotional response and agency     | Direct, Imagery, Metaphorical |

Participants select one main body area and must select at least one associated-feelings response; Not aware of feelings and Prefer not to say are available. All six suggestions mention the area. Each target has a recorded shared goal, expressed in three separately generated forms. Direct suggestions begin “Your [area] …”; imagery begins “Imagine your [area] …”; metaphorical suggestions use an explicit comparison. These are operational categories, not validated mechanisms. The server samples uniformly from 72 orders that alternate targets; human content review remains necessary.

Speech uses the same voice/instructions and **0.8× speed**, with **four seconds of inserted silence between sentences** and **three seconds before speech begins**. Native controls never autoplay. “Try” and its word forms are rejected before new audio generation. Existing cached recordings are retained unchanged.

## Local setup

Use Node.js 24. Run `npm ci`, copy `.env.example` to `.env.local`, configure server-only credentials, then run `npm run dev`. The pilot defaults to closed (`PILOT_ENABLED=false`); there is no production demo bypass. With a restricted global npm cache, use `npm ci --cache ../work/npm-cache`.

Create an approved-region Supabase project and apply both files in `supabase/migrations/` in order. They create the restricted research/credential tables and private `suggestion-audio` bucket, including WAV support. There is **no new database migration for the six-condition update**: the versioned session document stores the new fields. Never put secrets in `NEXT_PUBLIC_*`, source control, URLs, chat or logs.

See [deployment](docs/DEPLOYMENT.md), [protocol/data model](docs/PROTOCOL.md), [API/CSV exports](docs/API.md) and [privacy/operations](docs/PRIVACY.md) for configuration, retention and withdrawal handling.

## Verification

```sh
npm test
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

Core tests cover eligibility/baseline validation, six-condition assembly, prohibited wording, alternating-target randomisation, protocol transitions, reassessment, legacy retention, security, actual PostgreSQL-compatible migrations and measured WAV silence. Desktop/mobile browser checks use mocked external providers and simulated media completion. Live model quality, actual speech, mobile audio and assistive-technology review require owner testing. Client playback events do not verify attention, eye state or whether audio was heard.

## Privacy and versions

Participant access uses private HTTP-only cookies and server ownership checks. Supabase tables deny direct anon/authenticated access; state/event changes commit atomically with version checks. Optional emails are encrypted and stored separately; investigator CSV exports exclude emails and credentials. The public access gate and Vercel login protection remain enabled.

Current session/round protocol: `physical-targets-2x3-v4`; consent: `physical-context-consent-4`; content prompt: `physical-target-suggestions-5`; audio: `sentence-pauses-v3`. Start a **new session** to use the revised eligibility, measures and six-suggestion rounds. Older sessions, five-suggestion rounds, original allocations, texts, responses and audio remain unchanged; they cannot silently generate rounds under the new setup. Exports distinguish protocol and content/style fields, leaving legacy-only dimensions blank.

OpenAI currently documents retirement of the Speech API models on **6 January 2027**. This application uses the currently supported Speech endpoint; migration to the recommended replacement requires an audio-workflow change and verification, not just a model-name change. See [OpenAI speech documentation](https://developers.openai.com/api/docs/guides/text-to-speech). Existing defaults are `gpt-4.1-mini`, `gpt-4o-mini-tts`, and voice `coral`; keep model/voice settings fixed during an approved cohort.

Revision v2 requires duration in the selected body area (Less than 3 months / 3 months or longer) and at least one feelings response, including Not aware of feelings. Consent explains duration collection and OpenAI processing; CSV retains `symptom_duration`. Start a new session; older records remain unchanged. Invalid/truncated model output receives at most one corrective regeneration within bounded provider timeouts; refusal and moderation rejection still fail closed. No database migration is required.

Imagery asks participants to imagine the literal target experience: physical sensory qualities for sensory/discriminative, or an emotional/motivational response for affective/motivational. Metaphors, similes and symbolic substitutions are prohibited in imagery and reserved for Metaphorical. Explicit comparison markers are rejected and trigger the bounded corrective retry. This text screen cannot guarantee semantic separation; human content review remains necessary. Existing text/audio are retained; newly generated rounds use prompt version `physical-target-suggestions-5`.

Resonance revision: participant guidance uses Step 1 through Step 7, with listening/rating repeated for each suggestion. New sessions store `assessment` version `resonance-1`, exact question, explanation, anchors and Unable-to-rate option. Response events use `resonance_response`. Exports add construct/version/question/anchors, `response_value` and `resonance`; the existing `usefulness` column is retained only for historical usefulness records. Earlier sessions, responses and events are not relabelled or rewritten. Start a new session to use resonance; no database migration or credentials are needed.

Sensory closing revision: prompt `physical-target-suggestions-5` requests sensory bodies that lead toward possible softer, less intense sensation. The server appends a standardised, body-area-specific final sentence in Direct, literal Imagery or comparison-linked Metaphorical form (`sensory-closing-1`). Affective/motivational texts remain independently generated and are not given sensory closings. Moderation and TTS process the complete final text. Exact text, model-generated body, closing sentence and assembly version are retained/exported. Earlier generated text/audio remain unchanged; new rounds receive this revision. No efficacy, guaranteed change or required improvement is asserted. Pacing, resonance measurement and randomisation are unchanged.

Sensation-quality setup: before associated feelings, ask “What does the pain or discomfort feel like?” with multiple predefined choices (aching, sharp/stabbing, burning, throbbing, pressure, tightness, pulling, cramping, tingling, numbness, itching, heaviness, tenderness, shooting, or another sensation). At least one response is required; Hard to describe and Prefer not to say are exclusive alternatives. No free text or diagnostic inference is used. `associatedSensations` is stored in the session/round generation context and exported as `associated_sensations`. Disclosed qualities personalise sensory bodies; non-disclosure and Another sensation do not supply an invented quality. Consent explains processing by OpenAI. Existing records remain unchanged; start a new session. No migration or credentials are required.
