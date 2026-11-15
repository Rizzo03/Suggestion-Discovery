import 'server-only';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { cookies } from 'next/headers';
import { StudyError } from './study';
export function env(name: string) {
  const v = process.env[name];
  if (!v) throw new StudyError('Pilot service is not configured. Contact the study team.', 503);
  return v;
}
export function hash(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}
export function token() {
  return randomBytes(32).toString('base64url');
}
export function equal(a: string, b: string) {
  const x = Buffer.from(hash(a));
  const y = Buffer.from(hash(b));
  return timingSafeEqual(x, y);
}
export function secret(name: string) {
  const v = env(name);
  if (v.length < 32) throw new StudyError('Pilot security settings are incomplete.', 503);
  return v;
}
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};
function gateSignature(expiry: string) {
  return createHmac('sha256', secret('SESSION_SECRET'))
    .update(`pilot:${expiry}:${secret('PILOT_ACCESS_CODE')}`)
    .digest('hex');
}
export function gateValue() {
  const expiry = String(Date.now() + 86_400_000);
  return `${expiry}.${gateSignature(expiry)}`;
}
export async function gate() {
  if (process.env.PILOT_ENABLED !== 'true')
    throw new StudyError('This private technical pilot is currently closed.', 503);
  const value = (await cookies()).get('sd_pilot')?.value ?? '';
  const [expiry, signature] = value.split('.');
  if (
    !expiry ||
    Number(expiry) < Date.now() ||
    !signature ||
    !equal(signature, gateSignature(expiry))
  )
    throw new StudyError('Enter your private pilot access code.', 403);
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin)
    throw new StudyError('Request origin not allowed.', 403);
  if (req.headers.get('sec-fetch-site') === 'cross-site')
    throw new StudyError('Request origin not allowed.', 403);
}
export function admin(req: Request) {
  const bearer = req.headers.get('authorization') ?? '';
  if (!equal(bearer, `Bearer ${secret('RESEARCH_EXPORT_TOKEN')}`))
    throw new StudyError('Not authorised.', 401);
}
function encryptionKey() {
  const key = Buffer.from(env('CONTACT_ENCRYPTION_KEY'), 'base64');
  if (key.length !== 32) throw new StudyError('Email privacy settings are incomplete.', 503);
  return key;
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const bytes = Buffer.concat([c.update(value, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), bytes].map((b) => b.toString('base64')).join('.');
}
export function decrypt(value: string) {
  const [iv, tag, bytes] = value.split('.').map((x) => Buffer.from(x, 'base64'));
  const c = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  c.setAuthTag(tag);
  return Buffer.concat([c.update(bytes), c.final()]).toString('utf8');
}
