import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env, hash, secret } from './security';
import { createHmac } from 'node:crypto';
import { Session, Study, StudyError } from './study';
export function db() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function check(error: { message: string } | null) {
  if (error) {
    console.error('Database operation failed', { kind: 'database' });
    throw new StudyError('Could not save your progress. Please retry.', 503);
  }
}
export async function participant() {
  const raw = (await cookies()).get('sd_identity')?.value;
  if (!raw) throw new StudyError('Create or recover your participant ID first.', 401);
  const { data, error } = await db()
    .from('identity_tokens')
    .select('participant_id')
    .eq('token_hash', hash(raw))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  check(error);
  if (!data)
    throw new StudyError(
      'Your device sign-in expired. Use your recovery code or create a new ID.',
      401,
    );
  return data.participant_id as string;
}
export async function session(id: string, participantId: string): Promise<Session> {
  const { data, error } = await db()
    .from('sessions')
    .select('*')
    .eq('id', id)
    .eq('participant_id', participantId)
    .maybeSingle();
  check(error);
  if (!data) throw new StudyError('Session not found.', 404);
  return data as Session;
}
export async function commit(
  s: Session,
  next: Study,
  event: string,
  payload: Record<string, unknown> = {},
) {
  const { data, error } = await db().rpc('commit_session', {
    p_id: s.id,
    p_participant: s.participant_id,
    p_version: s.version,
    p_state: next,
    p_event: event,
    p_payload: payload,
  });
  check(error);
  if (!data) throw new StudyError('Progress changed in another tab. Reload to continue.');
  return { ...s, state: next, version: s.version + 1 };
}
export async function rateLimit(req: Request, scope: string, limit: number, seconds = 3600) {
  // Vercel overwrites x-forwarded-for. Do not trust this header on an unconfigured reverse proxy.
  const address = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const key = createHmac('sha256', secret('SESSION_SECRET'))
    .update(`${scope}:${address}`)
    .digest('hex');
  const { data, error } = await db().rpc('take_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_seconds: seconds,
  });
  check(error);
  if (!data) throw new StudyError('Too many attempts. Please wait and try again.', 429);
}
export async function participantLimit(id: string, scope: string, limit: number, seconds = 60) {
  const { data, error } = await db().rpc('take_rate_limit', {
    p_key: hash(`${scope}:${id}`),
    p_limit: limit,
    p_seconds: seconds,
  });
  check(error);
  if (!data) throw new StudyError('Please wait a moment before retrying.', 429);
}
