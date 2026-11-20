import { beforeEach, it, expect, vi } from 'vitest';
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (jar.has(n) ? { value: jar.get(n) } : undefined) }),
}));
import {
  admin,
  checkOrigin,
  decrypt,
  encrypt,
  gate,
  gateValue,
  hash,
  token,
} from '../lib/security';
beforeEach(() => {
  jar.clear();
  process.env.PILOT_ENABLED = 'true';
  process.env.SESSION_SECRET = 'a'.repeat(40);
  process.env.PILOT_ACCESS_CODE = 'b'.repeat(40);
  process.env.RESEARCH_EXPORT_TOKEN = 'c'.repeat(40);
  process.env.CONTACT_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString('base64');
});
it('rejects cross-site and missing-origin mutations', () => {
  expect(() =>
    checkOrigin(
      new Request('https://pilot.test/api/sessions', { headers: { origin: 'https://evil.test' } }),
    ),
  ).toThrow();
  expect(() => checkOrigin(new Request('https://pilot.test/api/sessions'))).toThrow();
  expect(() =>
    checkOrigin(
      new Request('https://pilot.test/api/sessions', { headers: { origin: 'https://pilot.test' } }),
    ),
  ).not.toThrow();
});
it('requires a valid, unexpired pilot cookie and explicit enablement', async () => {
  await expect(gate()).rejects.toThrow();
  jar.set('sd_pilot', gateValue());
  await expect(gate()).resolves.toBeUndefined();
  jar.set('sd_pilot', '0.fake');
  await expect(gate()).rejects.toThrow();
  jar.set('sd_pilot', gateValue());
  process.env.PILOT_ENABLED = 'false';
  await expect(gate()).rejects.toThrow(/closed/);
});
it('does not accept participant authentication for investigator access', () => {
  expect(() => admin(new Request('https://pilot.test/api/research/export'))).toThrow();
  expect(() =>
    admin(
      new Request('https://pilot.test/api/research/export', {
        headers: { authorization: `Bearer ${'c'.repeat(40)}` },
      }),
    ),
  ).not.toThrow();
});
it('encrypts contacts with integrity and generates high entropy recovery tokens', () => {
  const ciphertext = encrypt('participant@example.test');
  expect(ciphertext).not.toContain('participant');
  expect(decrypt(ciphertext)).toBe('participant@example.test');
  expect(encrypt('participant@example.test')).not.toBe(ciphertext);
  const bytes = ciphertext.split('.');
  bytes[1] = Buffer.alloc(16).toString('base64');
  expect(() => decrypt(bytes.join('.'))).toThrow();
  const a = token();
  expect(a.length).toBe(43);
  expect(hash(a)).not.toContain(a);
  expect(token()).not.toBe(a);
});

it('accepts a strong investigator token copied with surrounding whitespace but rejects wrong tokens', () => {
  const value = 'c'.repeat(64);
  process.env.RESEARCH_EXPORT_TOKEN = ` \n${value}\r\n`;
  const request = (token: string, scheme = 'Bearer') =>
    new Request('https://pilot.test/api/research/quality', {
      headers: { authorization: `${scheme} ${token}` },
    });
  expect(() => admin(request(value))).not.toThrow();
  expect(() => admin(request(`  ${value}  `))).not.toThrow();
  expect(() => admin(request(value, 'bearer'))).not.toThrow();
  expect(() => admin(request('d'.repeat(64)))).toThrow(/Not authorised/);
  expect(() => admin(request(value, 'Basic'))).toThrow(/Not authorised/);
  process.env.RESEARCH_EXPORT_TOKEN = ' '.repeat(32) + 'short' + ' '.repeat(32);
  expect(() => admin(request('short'))).toThrow(/security settings/);
  process.env.RESEARCH_EXPORT_TOKEN = `${value.slice(0, 32)} ${value.slice(32)}`;
  expect(() => admin(request(value))).toThrow(/Not authorised/);
});
