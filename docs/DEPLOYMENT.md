# Private Vercel deployment — owner actions

No deployment has been created by this change. Review and merge the development PR when ready. Creating a public GitHub repository does not make the participant pilot public: application access is gated and data is stored outside GitHub. Never commit pilot data or contact details to this repository.

## Services and credentials you provide

| Service            | Required action                                                                                                                             | Server configuration                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Supabase           | Create approved-region project; apply both migrations in order; verify private Storage bucket; restrict dashboard membership and enable MFA | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                                   |
| OpenAI             | Create a project API key; enable billing and approved model access; set spend alerts/budgets; review data processing/retention settings     | `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE` |
| Application        | Generate independent long random secrets; distribute the invitation code privately                                                          | `SESSION_SECRET`, `PILOT_ACCESS_CODE`, `RESEARCH_EXPORT_TOKEN`                |
| Contact encryption | Generate a 32-byte key, base64-encode it, keep a separate protected backup                                                                  | `CONTACT_ENCRYPTION_KEY`                                                      |
| Vercel             | Import repository as Next.js, use Node 24, configure protected preview and later protected production                                       | All values server-side; `PILOT_ENABLED=false` initially                       |
| Resend (optional)  | Verify sender domain, review processor/privacy arrangements, configure provider key and sender                                              | `RESEND_API_KEY`, `EMAIL_FROM`                                                |

Do not enable email collection before configuring its encryption key and a delivery/retention process. Research works without email. The UI explains that a request is queued; it does not claim immediate delivery.

## Deployment sequence

1. Finish ethics, privacy, data retention, investigator/contact and withdrawal arrangements for the invited technical testers. Replace the invitation-based contact wording in the consent screen with approved study-specific details before recruitment. Do not recruit publicly with the pilot text.
2. In Vercel, configure **Deployment Protection** for previews and production before enabling participants or deploying real credentials. Confirm the selected plan supports the required protection. Disable unwanted automatic deployments/integration previews, particularly public previews from the GitHub PR.
3. Use a separate Supabase project and nonproduction OpenAI credentials for preview; never point untrusted branch previews at a production database. Only trusted collaborators should control code that receives server secrets. Do not enable Vercel analytics, session replay, or third-party client tracking for this pilot.
4. Add environment variables privately in Vercel, initially leaving `PILOT_ENABLED=false`. Set a supported function execution limit of at least 120 seconds for the API route (the source exports `maxDuration=120`). Choose an appropriate hosting/data region and verify request timeouts and memory limits for the approved session lengths and export volume.
5. Deploy privately **only after owner approval**. Verify an unauthenticated visitor cannot enter or call participant APIs; verify a known pilot invitation can. Set `PILOT_ENABLED=true` only in that protected environment when ready. This is a server setting and requires redeployment for changes to take effect.
6. Run a synthetic tester session: eyes-closed instructions and the three-second silent lead-in, all six content/style combinations, zero and unable ratings, refresh/resume, recovery from another device, stop halfway, restart, and the check-in after 18 suggestions. Inspect stored prompts/models/order, audio hashes and server timestamps. Listen on real mobile devices, with headphones if appropriate; confirm speech content matches retained text and record any deviations.
7. Export all four datasets using the investigator credential; confirm participant cookies cannot export and browser `anon`/`authenticated` roles cannot read/write tables or Storage. Confirm audio download is denied for other sessions and responded suggestions.
8. If email is enabled, end a synthetic session, separately consent, run the private dispatcher, inspect delivery, and verify encrypted contact removal after success. Confirm cancellation and failure handling.
9. Review costs, model lifecycle, content safety, logs, accessibility and operational recovery with the study team. The current Speech API model is scheduled for retirement on 6 January 2027; migrate the speech workflow and reverify before that date if the pilot will continue.

## Email scheduling

No automatic cron or delivery is activated. An investigator can call `POST /api/research/send-feedback` with the separate bearer token, or configure a trusted private scheduler to do so. The endpoint processes at most ten pending requests per call and requires `RESEND_API_KEY` and `EMAIL_FROM`. Keep bearer tokens in scheduler secret storage and out of URLs. Feedback is deterministic, describing the participant's selected experiences and participation counts; it does not rank improvement or imply benefit.

## Before any public launch

A public launch requires a new owner decision and approval of the study protocol, ethics and privacy requirements, study-specific consent, retention/deletion automation, infrastructure and incident plan, model/content evaluation, and accessibility testing with intended participants. The invitation gate and deployment protection are pilot controls, not a claim of regulatory compliance. No public deployment is part of this PR.

For the eyes-closed-only update, apply `supabase/migrations/202611160001_wav_lead_in.sql` after the initial migration. It adds `audio/wav` to the private bucket while retaining MP3 support for earlier recordings. New audio files are WAV and include the measured silent lead-in.

For `physical-targets-2x3-v1`, review the physical-symptom eligibility/consent wording, self-reported baseline requirement, two targets crossed with Direct, Imagery and Metaphorical forms, constrained presentation order and 18-suggestion reassessment. Earlier sessions must end before starting the new protocol. Existing JSON schema/Storage migrations suffice; no new migration is required. Private access protection remains unchanged.

The revised setup requires a predefined main body area and permits optional associated feelings, including exclusive None/Prefer-not-to-say choices. Session CSV adds `primary_location` and `associated_feelings`. Disclosed context is retained and sent to OpenAI for generation; no feelings are inferred when omitted. Start a new session for this protocol; historical records and audio remain unchanged. No new database migration or credentials are required.
