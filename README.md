# Suggestion Discovery

An invitation-only, mobile-friendly listening platform for **adults currently experiencing physical pain or an uncomfortable physical sensation**. Next.js, TypeScript, Supabase and OpenAI; hosted as a protected Vercel technical pilot. Not treatment and not approved for public recruitment. No therapeutic efficacy or measure-validation claims.

Developed by **Dr Rod Rizzo — Pain Scientist — Centre for Pain IMPACT, Neuroscience Research Australia**. Contact: [r.rizzo@neura.edu.au](mailto:r.rizzo@neura.edu.au).

## Current participant flow

1. Create a random participant ID or optionally recover an earlier ID. No name or email required.
2. Read the coded-data research information and separately confirm adult/private-invitation eligibility, current physical symptoms and research consent.
3. Select **Physical pain**, **Uncomfortable physical sensation**, or both; rate each on 0–10. At least one selected symptom must have a baseline intensity above zero. Subsequent measurements may be zero.
4. Listen with eyes closed to **six suggestions per round**: three content categories × two wording styles.
5. After each recording, open eyes and submit a required 0–10 usefulness response or Unable to rate before the next suggestion becomes available.
6. Reassess every selected physical symptom after three complete rounds (**18 suggestions**), before continuing. Stop at any point or continue without a round-count ceiling.
7. Optionally request one separately consented feedback email after ending a session.

| Content category       | Operational boundary                                                                                     | Styles              |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------- |
| External attention     | Notice real neutral external sounds or contact with a supporting surface; no imagined scene or metaphor  | Direct + permissive |
| Imagery                | Imagine a concrete sensory scene; no symbolic comparison or instruction to attend to actual surroundings | Direct + permissive |
| Metaphorical reframing | Explicit everyday comparison concerning one's relationship to the physical symptom                       | Direct + permissive |

The model generates one list of shared instruction bodies per category. The server assembles its pair using only **“Now, …”** versus **“You might …”**; bodies and order are identical. A random round order is sampled uniformly from all permutations that keep each matched pair nonadjacent. These operational categories are not a validated taxonomy; review generated content for adherence before recruitment. Pair separation reduces immediate repetition but does not eliminate order/carryover effects.

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

Core tests cover eligibility/baseline validation, six-condition assembly, prohibited wording, nonadjacent randomisation, protocol transitions, reassessment, legacy retention, security, actual PostgreSQL-compatible migrations and measured WAV silence. Desktop/mobile browser checks use mocked external providers and simulated media completion. Live model quality, actual speech, mobile audio and assistive-technology review require owner testing. Client playback events do not verify attention, eye state or whether audio was heard.

## Privacy and versions

Participant access uses private HTTP-only cookies and server ownership checks. Supabase tables deny direct anon/authenticated access; state/event changes commit atomically with version checks. Optional emails are encrypted and stored separately; investigator CSV exports exclude emails and credentials. The public access gate and Vercel login protection remain enabled.

Current session/round protocol: `physical-3x2-v1`; consent: `physical-consent-1`; content prompt: `physical-suggestions-2`; audio: `sentence-pauses-v3`. Start a **new session** to use the revised eligibility, measures and six-suggestion rounds. Older sessions, five-suggestion rounds, original allocations, texts, responses and audio remain unchanged; they cannot silently generate rounds under the new setup. Exports distinguish protocol and content/style fields, leaving legacy-only dimensions blank.

OpenAI currently documents retirement of the Speech API models on **6 January 2027**. This application uses the currently supported Speech endpoint; migration to the recommended replacement requires an audio-workflow change and verification, not just a model-name change. See [OpenAI speech documentation](https://developers.openai.com/api/docs/guides/text-to-speech). Existing defaults are `gpt-4.1-mini`, `gpt-4o-mini-tts`, and voice `coral`; keep model/voice settings fixed during an approved cohort.
