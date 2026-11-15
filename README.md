# Suggestion Discovery

A mobile-friendly, invitation-only technical pilot for exploratory research into responses to audio-delivered therapeutic-style suggestions. Built with Next.js App Router, TypeScript, Supabase and OpenAI; prepared for Vercel. **Not deployed. Not treatment. Not an ethics-approved recruitment platform.** No therapeutic efficacy or measurement-validation claims.

## What is implemented

- Anonymous device IDs with HTTP-only sign-in cookies; optional high-entropy recovery codes for returning across devices. No name or account email required.
- Separate, versioned research consent; all eleven experience categories; explicit baseline 0–10 intensity responses for every selection.
- Five distinct OpenAI-generated suggestions per round: metaphor, permissive, direct, imagery and attentional shift. Structured output validation and moderation fail closed. Full text, exact prompt, prompt version, actual returned model and provider response ID are retained.
- Eyes-closed-only listening for all new rounds, with a gentle breathing instruction and a three-second silent lead-in after Play. Earlier eye-allocation records are preserved. Independent Fisher–Yates presentation order per round, with algorithm, timestamp and realised order preserved.
- Server-generated OpenAI speech, a fixed default voice/pacing instruction, AI-voice disclosure, accessible native audio controls and private cached WAV audio with a three-second silent lead-in. Audio is prepared and played only on request. No autoplay or automatic next suggestion.
- Required usefulness response after each listening completion: integer 0–10 or explicit “Unable to rate”. The precise research question and standard explanation are shown; no rating is preselected.
- A required intensity check-in after every three **complete** rounds, before a further round. No round-count ceiling. Stopping, partial rounds, resume and session timestamps are recorded.
- Optional neutral exploration challenge; no reward, improvement target, leaderboard or usefulness-based encouragement.
- Optional separately consented **post-session** email summary, encrypted contact storage, delivery outbox and investigator-only dispatcher. No email collection or feedback during active rounds.
- Investigator-only paginated CSV exports for sessions/randomisation, suggestions/responses/AI/audio metadata, intensity measurements and playback events. Contact addresses, credential hashes and secrets are excluded.
- Deny-by-default database permissions and RLS; all access through server ownership checks. Compare-and-swap state updates and events are committed in a single database transaction.

## Local setup

Use Node.js 24 and npm. The lockfile pins the installed dependencies.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The page is available at `http://localhost:3000`. The pilot is **closed by default** (`PILOT_ENABLED=false`). It cannot collect data or generate suggestions until you configure Supabase, OpenAI, strong secrets and explicitly enable it. There is no production demo bypass.

Create a Supabase project in an approved region. Apply `supabase/migrations/202611150001_pilot.sql` using the Supabase SQL editor or your established Supabase migration workflow. The migration assumes a standard Supabase project with `anon`, `authenticated`, `service_role` and Storage installed. It creates the private `suggestion-audio` bucket. Use the server service-role key; no browser Supabase client or public anon key is required.

Configure the variables listed in `.env.example`. Generate distinct random secrets of at least 32 characters for `SESSION_SECRET`, `PILOT_ACCESS_CODE` and `RESEARCH_EXPORT_TOKEN`; generate the separate encryption key with `openssl rand -base64 32`. Keep `.env.local` out of version control. Never put these values in `NEXT_PUBLIC_*`, a PR, browser JavaScript, URLs, screenshots, or logs.

For development installations with a restricted global npm cache, use `npm ci --cache ../work/npm-cache`.

## Verification

```sh
npm test
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

Unit and route tests exercise the real protocol transitions with mocked AI/storage services. PostgreSQL tests use PGlite to execute the actual migration and verify grants, RLS flags, atomic updates/events, ownership, uniqueness and rate limits. Browser tests exercise consent, multiple intensity ratings, listening/rating gating, explicit next-audio preparation, post-session email placement, and narrow/desktop layouts. Media completion in browser tests is simulated. CI runs the same checks; it uses no live research data or secrets.

**Live verification still requires your credentials:** Supabase migration/Storage smoke test, actual model availability and safe generated content, native audio on iOS/Android with eyes-closed instructions, email provider delivery, Vercel protection, and investigator export permissions. Automated tests cannot verify a person's eye state, attention or whether they heard the audio. Client playback events are observations, not proof of exposure.

See [deployment instructions](docs/DEPLOYMENT.md), [study and data protocol](docs/PROTOCOL.md), [API and export reference](docs/API.md), and [privacy/operations](docs/PRIVACY.md).

## Sources and model lifecycle

Implementation follows the official [Next.js cookie reference](https://nextjs.org/docs/app/api-reference/functions/cookies), [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), [database function permissions](https://supabase.com/docs/guides/database/functions), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [text-to-speech documentation](https://developers.openai.com/api/docs/guides/text-to-speech).

Defaults are `gpt-4.1-mini` for suggestions and `gpt-4o-mini-tts` / `coral` for speech. Set model names explicitly for your approved pilot and record changes as protocol changes. **OpenAI currently documents the Speech API models as scheduled to shut down on 6 January 2027.** This implementation uses the currently supported Speech endpoint; replacing it with the recommended Realtime workflow is an API migration, not merely an environment-variable change. Complete that migration and verify exact spoken content before running this pilot after that date. The model and voice actually requested are stored per audio asset. Review current provider model lifecycle before enabling any deployment.

Protocol update: new rounds use `eyes-closed-v1` and consent `pilot-consent-3`. Apply **both** SQL migrations in order, including `202611160001_wav_lead_in.sql`, to permit the WAV files. Existing MP3 files and earlier rounds are retained unchanged. Suggestion-type order is still randomised independently per round.
