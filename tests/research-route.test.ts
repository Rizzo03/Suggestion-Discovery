import { beforeEach, expect, it, vi } from 'vitest';
import { fixture } from './fixtures';
import type { Session } from '../lib/study';
const store = vi.hoisted(() => ({
  sessions: [] as Session[],
  queries: [] as { start: number; end: number; cutoff: string }[],
}));
vi.mock('../lib/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/db')>();
  return {
    ...original,
    db: () => ({
      from: (table: string) => {
        if (table !== 'sessions') throw new Error('Unexpected table');
        let cutoff = '';
        const q = {
          select: () => q,
          lte: (_: string, value: string) => {
            cutoff = value;
            return q;
          },
          order: () => q,
          range: async (start: number, end: number) => {
            store.queries.push({ start, end, cutoff });
            return { data: store.sessions.slice(start, end + 1), error: null };
          },
        };
        return q;
      },
    }),
  };
});
import { handle } from '../lib/api';
const secret = 'q'.repeat(40);
function req(query = '', authorized = true) {
  return handle(
    new Request(`https://pilot.test/api/research/quality${query}`, {
      headers: authorized
        ? { Authorization: `Bearer ${secret}` }
        : { Cookie: 'sd_identity=participant; sd_pilot=invitation' },
    }),
    ['research', 'quality'],
  );
}
beforeEach(() => {
  process.env.RESEARCH_EXPORT_TOKEN = secret;
  store.sessions = [];
  store.queries = [];
});
function samples(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    participant_id: `p${i}`,
    state: fixture(),
    created_at: '2026-11-15T00:00:00.000Z',
    version: 1,
  }));
}
it('requires investigator auth before reading data and never accepts participant cookies or URL tokens', async () => {
  expect((await req('', false)).status).toBe(401);
  expect((await req(`?token=${secret}`, false)).status).toBe(401);
  expect(store.queries).toHaveLength(0);
});
it('reads every page in the scan with a fixed cutoff and returns aggregate-only no-store data', async () => {
  store.sessions = samples(201);
  const response = await req('?until=2026-11-16T00%3A00%3A00.000Z');
  expect(response.status).toBe(200);
  const report = await response.json();
  expect(report.counts.scannedSessions).toBe(201);
  expect(report.truncated).toBe(false);
  expect(store.queries).toHaveLength(3);
  expect(new Set(store.queries.map((q) => q.cutoff)).size).toBe(1);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(JSON.stringify(report)).not.toContain('participant_id');
  expect(JSON.stringify(report)).not.toContain(secret);
});
it('explicitly flags a partial report at the scan limit and validates parameters', async () => {
  store.sessions = samples(2001);
  const report = await (await req()).json();
  expect(report.truncated).toBe(true);
  expect(report.counts.scannedSessions).toBe(2000);
  expect(store.queries.at(-1)?.start).toBe(2000);
  store.queries = [];
  expect((await req('?window=unknown')).status).toBe(400);
  expect(store.queries).toHaveLength(0);
});
