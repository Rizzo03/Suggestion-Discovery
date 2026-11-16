import 'server-only';
import { cookies } from 'next/headers';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, check, participant, session, commit, rateLimit, participantLimit } from './db';
import {
  admin,
  checkOrigin,
  cookieOptions,
  decrypt,
  encrypt,
  env,
  equal,
  gate,
  gateValue,
  hash,
  secret,
  token,
} from './security';
import {
  assertActive,
  baselineSchema,
  canGenerate,
  CONSENT_VERSION,
  csv,
  currentSuggestion,
  exactRatings,
  intensitySchema,
  PROMPT_VERSION,
  reassess,
  respond,
  Session,
  shuffle,
  Study,
  StudyError,
  TYPES,
} from './study';
import { generate, speech } from './ai';
import { intensityRows, sessionRows, suggestionRows } from './export';
const uuid = z.string().uuid();
const now = () => new Date().toISOString();
async function body(req: Request) {
  if (!req.headers.get('content-type')?.includes('application/json'))
    throw new StudyError('Use JSON for this request.', 415);
  const text = await req.text();
  if (Buffer.byteLength(text) > 16000) throw new StudyError('Request too large.', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new StudyError('Invalid JSON.', 400);
  }
}
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function publicSession(s: Session) {
  return { id: s.id, state: s.state, created_at: s.created_at };
}
async function getState(id: string) {
  const { data: sessions, error } = await db()
    .from('sessions')
    .select('*')
    .eq('participant_id', id)
    .order('created_at', { ascending: false })
    .limit(1);
  check(error);
  const { data: p, error: e } = await db()
    .from('participants')
    .select('recovery_hash')
    .eq('id', id)
    .single();
  check(e);
  const latest = sessions?.[0];
  let feedbackStatus: string | undefined;
  if (latest?.state.status === 'stopped') {
    const { data: contact, error: contactError } = await db()
      .from('email_requests')
      .select('status')
      .eq('session_id', latest.id)
      .eq('participant_id', id)
      .maybeSingle();
    check(contactError);
    feedbackStatus = contact?.status;
  }
  return {
    participantId: id,
    recoveryEnabled: !!p?.recovery_hash,
    session: latest ? { ...publicSession(latest), feedbackStatus } : null,
  };
}
export async function handle(req: Request, path: string[]) {
  try {
    const route = path.join('/');
    const method = req.method;
    // Investigator routes use a separate bearer secret, never participant cookies.
    if (route === 'research/export' && method === 'GET') {
      admin(req);
      return await exportData(req);
    }
    if (route === 'research/send-feedback' && method === 'POST') {
      admin(req);
      return await sendFeedback();
    }
    if (method !== 'GET') checkOrigin(req);
    if (route === 'access' && method === 'POST') {
      if (process.env.PILOT_ENABLED !== 'true')
        throw new StudyError('This private technical pilot is currently closed.', 503);
      await rateLimit(req, 'access', 10, 900);
      const b = z.object({ code: z.string().max(256) }).parse(await body(req));
      if (!equal(b.code, secret('PILOT_ACCESS_CODE')))
        throw new StudyError('Access code not recognised.', 403);
      (await cookies()).set('sd_pilot', gateValue(), { ...cookieOptions, maxAge: 86400 });
      return json({ ok: true });
    }
    await gate();
    if (route === 'identity' && method === 'POST') {
      await rateLimit(req, 'identity', 10);
      const raw = token();
      const { data, error } = await db().rpc('create_identity', { p_hash: hash(raw) });
      check(error);
      (await cookies()).set('sd_identity', raw, cookieOptions);
      return json(await getState(data));
    }
    if (route === 'recover' && method === 'POST') {
      await rateLimit(req, 'recovery', 10, 900);
      const b = z.object({ code: z.string().min(40).max(100) }).parse(await body(req));
      const { data, error } = await db()
        .from('participants')
        .select('id')
        .eq('recovery_hash', hash(b.code.trim()))
        .maybeSingle();
      check(error);
      if (!data) throw new StudyError('Recovery code not recognised.', 401);
      const raw = token();
      const { error: e } = await db()
        .from('identity_tokens')
        .insert({ token_hash: hash(raw), participant_id: data.id });
      check(e);
      (await cookies()).set('sd_identity', raw, cookieOptions);
      return json(await getState(data.id));
    }
    const p = await participant();
    if (route === 'me' && method === 'GET') return json(await getState(p));
    if (route === 'logout' && method === 'POST') {
      const jar = await cookies();
      const raw = jar.get('sd_identity')?.value;
      if (raw) {
        const { error } = await db()
          .from('identity_tokens')
          .delete()
          .eq('token_hash', hash(raw))
          .eq('participant_id', p);
        check(error);
      }
      jar.delete('sd_identity');
      return json({ ok: true });
    }
    if (route === 'recovery' && method === 'POST') {
      await participantLimit(p, 'recovery', 3, 3600);
      const code = token();
      const { error } = await db()
        .from('participants')
        .update({ recovery_hash: hash(code) })
        .eq('id', p);
      check(error);
      return json({ code });
    }
    if (route === 'sessions' && method === 'POST') {
      await participantLimit(p, 'new-session', 10, 3600);
      const b = baselineSchema.parse(await body(req));
      exactRatings(b.experiences, b.ratings);
      const at = now();
      const state: Study = {
        experiences: b.experiences,
        consentVersion: CONSENT_VERSION,
        consentAt: at,
        baseline: { ratings: b.ratings, at },
        reassessments: [],
        protocolVersion: 'eyes-closed-v1',
        firstEye: 'closed',
        allocation: { algorithm: 'fixed eyes closed; eyes-closed-v1', at },
        rounds: [],
        status: 'active',
      };
      const { data, error } = await db()
        .from('sessions')
        .insert({ participant_id: p, state })
        .select('*')
        .single();
      if (error?.code === '23505')
        throw new StudyError('You already have an active session. Reload to resume.');
      check(error);
      return json(publicSession(data), 201);
    }
    if (path[0] !== 'sessions' || !uuid.safeParse(path[1]).success)
      throw new StudyError('Not found.', 404);
    const s = await session(path[1], p);
    const action = path[2];
    if (method === 'GET' && !action) return json(publicSession(s));
    if (action === 'round' && method === 'POST') {
      canGenerate(s.state);
      await participantLimit(p, 'generation', 6, 60);
      const lease = { id: randomUUID(), at: now() };
      const claimed = await commit(s, { ...s.state, generation: lease }, 'generation_started', {
        lease: lease.id,
      });
      try {
        const ai = await generate(s.state.experiences);
        const at = now();
        const n = s.state.rounds.length + 1;
        const order = shuffle(TYPES, randomInt);
        const round = {
          id: randomUUID(),
          number: n,
          eye: 'closed' as const,
          protocolVersion: 'eyes-closed-v1',
          order,
          randomisation: { algorithm: 'Fisher-Yates; node:crypto.randomInt; v1', at },
          model: ai.model,
          promptVersion: PROMPT_VERSION,
          pairedInstructionBodies: ai.pairedInstructionBodies,
          prompt: ai.prompt,
          responseId: ai.responseId,
          createdAt: at,
          suggestions: order.map((type, i) => ({
            id: randomUUID(),
            type,
            text: ai.suggestions.find((x) => x.type === type)!.text,
            position: i + 1,
          })),
        };
        return json(
          publicSession(
            await commit(
              claimed,
              { ...claimed.state, generation: undefined, rounds: [...s.state.rounds, round] },
              'round_prepared',
              { roundId: round.id, order, eye: round.eye },
            ),
          ),
        );
      } catch (error) {
        const latest = await session(s.id, p);
        if (latest.state.generation?.id === lease.id)
          await commit(latest, { ...latest.state, generation: undefined }, 'generation_failed');
        throw error;
      }
    }
    if (action === 'intensity' && method === 'POST') {
      const b = z.object({ ratings: intensitySchema }).parse(await body(req));
      return json(
        publicSession(
          await commit(s, reassess(s.state, b.ratings, now()), 'intensity_reassessment', {
            ratings: b.ratings,
          }),
        ),
      );
    }
    if (action === 'stop' && method === 'POST') {
      if (s.state.status === 'stopped') return json(publicSession(s));
      return json(
        publicSession(
          await commit(
            s,
            { ...s.state, status: 'stopped', endedAt: now(), generation: undefined },
            'session_ended',
            { completeRounds: s.state.rounds.filter((r) => r.completedAt).length },
          ),
        ),
      );
    }
    if (action === 'feedback' && method === 'POST') {
      if (s.state.status !== 'stopped')
        throw new StudyError('Email feedback is available only after ending a session.');
      const b = z
        .object({ email: z.email().max(254), consent: z.literal(true) })
        .parse(await body(req));
      await participantLimit(p, 'email', 3, 3600);
      const { error } = await db()
        .from('email_requests')
        .insert({
          participant_id: p,
          session_id: s.id,
          encrypted_email: encrypt(b.email),
          consent_version: 'email-feedback-2',
        });
      if (error?.code === '23505')
        throw new StudyError('A feedback request already exists for this session.');
      check(error);
      return json({ ok: true });
    }
    if (action === 'feedback' && method === 'DELETE') {
      const { data, error } = await db()
        .from('email_requests')
        .update({ status: 'cancelled', encrypted_email: '' })
        .eq('session_id', s.id)
        .eq('participant_id', p)
        .eq('status', 'pending')
        .select('id');
      check(error);
      if (!data?.length)
        throw new StudyError(
          'This request is no longer pending; it may already be sending or sent. Contact the study team.',
        );
      return json({ ok: true });
    }
    if (action === 'suggestions' && uuid.safeParse(path[3]).success) {
      assertActive(s.state);
      const x = currentSuggestion(s.state);
      if (!x || x.id !== path[3]) throw new StudyError('Only the current suggestion is available.');
      const audioAction = path[4];
      if (audioAction === 'audio' && method === 'POST') {
        if (x.audioPath) return json({ ok: true });
        await participantLimit(p, 'speech', 8, 60);
        const audio = await speech(x.text);
        const key = `${p}/${s.id}/${x.id}/${randomUUID()}.wav`;
        const { error } = await db()
          .storage.from('suggestion-audio')
          .upload(key, audio.bytes, { contentType: 'audio/wav', upsert: false });
        if (error) throw new StudyError('Could not prepare audio. Please retry.', 503);
        try {
          const latest = await session(s.id, p);
          assertActive(latest.state);
          const next = structuredClone(latest.state);
          const cur = currentSuggestion(next);
          if (cur?.id !== x.id) throw new StudyError('Progress changed. Reload.');
          if (cur.audioPath) {
            await db().storage.from('suggestion-audio').remove([key]);
            return json({ ok: true });
          }
          Object.assign(cur, {
            audioPath: key,
            audioSha256: hash(audio.bytes),
            audioModel: audio.model,
            voice: audio.voice,
            voiceInstructions: audio.instructions,
            audioCreatedAt: now(),
            audioRequestId: audio.requestId,
            audioLeadInSeconds: audio.leadInSeconds,
            audioPauseSeconds: audio.pauseSeconds,
            audioSegments: audio.segments,
            audioRequestIds: audio.requestIds,
            audioProtocolVersion: audio.protocolVersion,
          });
          await commit(latest, next, 'audio_prepared', { suggestionId: x.id });
        } catch (err) {
          await db().storage.from('suggestion-audio').remove([key]);
          throw err;
        }
        return json({ ok: true });
      }
      if (audioAction === 'audio' && method === 'GET') {
        if (!x.audioPath) throw new StudyError('Prepare audio first.');
        const { data, error } = await db().storage.from('suggestion-audio').download(x.audioPath);
        check(error);
        if (!data) throw new StudyError('Audio unavailable.', 503);
        return new Response(data, {
          headers: {
            'Content-Type': x.audioPath.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg',
            'Cache-Control': 'private, no-store',
          },
        });
      }
      if (audioAction === 'events' && method === 'POST') {
        const b = z
          .object({
            event: z.enum(['play', 'pause', 'ended', 'seeked', 'error']),
            position: z.number().finite().min(0).max(3600),
            duration: z.number().finite().min(0).max(3600),
            clientAt: z.string().datetime(),
          })
          .parse(await body(req));
        await participantLimit(p, 'playback', 120, 60);
        if (!x.audioPath) throw new StudyError('Prepare audio first.');
        const next = structuredClone(s.state);
        if (b.event === 'ended') {
          if (b.duration < 1 || b.position < b.duration - 1)
            throw new StudyError('Finish listening before rating.');
          currentSuggestion(next)!.heardAt = now();
        }
        return json(
          publicSession(
            await commit(s, next, `audio_${b.event}`, {
              ...b,
              suggestionId: x.id,
              roundId: s.state.rounds.at(-1)!.id,
            }),
          ),
        );
      }
      if (audioAction === 'response' && method === 'POST') {
        const b = z
          .object({ value: z.number().int().min(0).max(10).nullable() })
          .parse(await body(req));
        return json(
          publicSession(
            await commit(s, respond(s.state, x.id, b.value, now()), 'usefulness_response', {
              suggestionId: x.id,
              value: b.value,
            }),
          ),
        );
      }
    }
    throw new StudyError('Not found.', 404);
  } catch (error) {
    if (error instanceof StudyError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: 'Check the information you entered and try again.' }, 400);
    // Never log prompts, participant input, emails, tokens, or provider error bodies.
    console.error('API request failed', { kind: error instanceof Error ? error.name : 'unknown' });
    return json(
      {
        error:
          'The service could not complete this step. Your saved responses are retained. Please retry or stop.',
      },
      502,
    );
  }
}
async function exportData(req: Request) {
  const url = new URL(req.url);
  const dataset = z
    .enum(['sessions', 'suggestions', 'intensity', 'events'])
    .parse(url.searchParams.get('dataset') ?? 'sessions');
  const after = z
    .string()
    .datetime()
    .optional()
    .parse(url.searchParams.get('after') ?? undefined);
  const until = z
    .string()
    .datetime()
    .parse(url.searchParams.get('until') ?? now());
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .parse(url.searchParams.get('offset') ?? 0);
  const limit = 200;
  if (dataset === 'events') {
    let q = db()
      .from('research_events')
      .select('*')
      .lte('created_at', until)
      .order('created_at')
      .order('id')
      .range(offset, offset + limit - 1);
    if (after) q = q.gt('created_at', after);
    const { data, error } = await q;
    check(error);
    return csvResponse(csv(data ?? []), dataset, data?.length ?? 0, offset, until);
  }
  let q = db()
    .from('sessions')
    .select('*')
    .lte('created_at', until)
    .order('created_at')
    .order('id')
    .range(offset, offset + limit - 1);
  if (after) q = q.gt('created_at', after);
  const { data, error } = await q;
  check(error);
  const sessions = (data ?? []) as Session[];
  const rows =
    dataset === 'sessions'
      ? sessionRows(sessions)
      : dataset === 'suggestions'
        ? suggestionRows(sessions)
        : intensityRows(sessions);
  return csvResponse(csv(rows), dataset, sessions.length, offset, until);
}
function csvResponse(text: string, name: string, count: number, offset: number, until: string) {
  return new Response(text, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="suggestion-discovery-${name}.csv"`,
      'Cache-Control': 'no-store',
      'X-Next-Offset': count === 200 ? String(offset + 200) : '',
      'X-Export-Until': until,
    },
  });
}
async function sendFeedback() {
  const apiKey = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM');
  const { data, error } = await db()
    .from('email_requests')
    .select('*')
    .eq('status', 'pending')
    .order('consent_at')
    .limit(10);
  check(error);
  let sent = 0;
  for (const item of data ?? []) {
    const s = await session(item.session_id, item.participant_id);
    if (s.state.status !== 'stopped') continue;
    const address = decrypt(item.encrypted_email);
    // Claim before contacting the provider; cancellation and concurrent dispatch cannot race.
    const { data: claimed, error: claimError } = await db()
      .from('email_requests')
      .update({ status: 'sending' })
      .eq('id', item.id)
      .eq('status', 'pending')
      .select('id');
    check(claimError);
    if (!claimed?.length) continue;
    const rounds = s.state.rounds.filter((r) => r.completedAt).length;
    const listened = s.state.rounds.flatMap((r) => r.suggestions).filter((x) => x.heardAt).length;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `feedback-${item.id}`,
      },
      body: JSON.stringify({
        from,
        to: address,
        subject: 'Your Suggestion Discovery session',
        text: `Thank you for taking part in the private Suggestion Discovery technical pilot.\n\nIn this session you completed ${rounds} rounds and listened to ${listened} suggestions. You explored: ${s.state.experiences.join(', ')}. Your responses are individual observations, not evidence of treatment benefit. Usefulness can include relating differently to an experience without reducing its intensity. There is no expected score or improvement.\n\nThis is exploratory research, not healthcare. Contact the study team through your invitation for questions, privacy requests, or withdrawal.`,
      }),
    });
    if (!response.ok)
      throw new StudyError(
        'Email delivery needs investigator reconciliation before retrying this request.',
        502,
      );
    const result = await response.json();
    const { error: e } = await db()
      .from('email_requests')
      .update({ status: 'sent', sent_at: now(), provider_id: result.id, encrypted_email: '' })
      .eq('id', item.id)
      .eq('status', 'sending');
    check(e);
    sent++;
  }
  return json({ sent });
}
