import { beforeEach, describe, it, expect, vi } from 'vitest';
import { Session, StudyError, TYPES } from '../lib/study';
import { fixture } from './fixtures';
const mock = vi.hoisted(() => ({
  session: null as Session | null,
  events: [] as string[],
  generate: vi.fn(),
  uploads: new Map<string, Buffer>(),
  contacts: [] as unknown[],
}));
vi.mock('../lib/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/security')>();
  return { ...actual, gate: async () => {}, encrypt: (v: string) => `encrypted:${v}` };
});
vi.mock('../lib/db', () => ({
  db: () => ({
    from: (name: string) => ({
      insert: (row: unknown) => {
        if (name === 'email_requests') mock.contacts.push(row);
        return Promise.resolve({ error: null });
      },
    }),
    storage: {
      from: () => ({
        upload: async (key: string, data: Buffer) => {
          mock.uploads.set(key, data);
          return { error: null };
        },
        remove: async (keys: string[]) => {
          keys.forEach((k) => mock.uploads.delete(k));
          return { error: null };
        },
        download: async (key: string) => ({
          data: new Blob([new Uint8Array(mock.uploads.get(key)!)]),
          error: null,
        }),
      }),
    },
  }),
  participant: async () => mock.session!.participant_id,
  session: async (id: string, p: string) => {
    if (id !== mock.session?.id || p !== mock.session.participant_id)
      throw new StudyError('Session not found.', 404);
    return structuredClone(mock.session);
  },
  commit: async (s: Session, state: Session['state'], event: string) => {
    if (s.version !== mock.session!.version)
      throw new StudyError('Progress changed in another tab.');
    mock.events.push(event);
    mock.session = { ...s, state, version: s.version + 1 };
    return structuredClone(mock.session);
  },
  check: (e: unknown) => {
    if (e) throw new Error('database');
  },
  rateLimit: async () => {},
  participantLimit: async () => {},
}));
vi.mock('../lib/ai', () => ({
  generate: mock.generate,
  speech: async () => ({
    bytes: Buffer.from('audio-fixture'),
    model: 'tts-test',
    voice: 'coral',
    instructions: 'standard',
    requestId: 'audio-request',
  }),
}));
import { handle } from '../lib/api';
const sid = '00000000-0000-4000-8000-000000000001';
const pid = '00000000-0000-4000-8000-000000000002';
async function request(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  return handle(
    new Request(`https://pilot.test/api/${path}`, {
      method,
      headers: { origin: 'https://pilot.test', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    path.split('/'),
  );
}
beforeEach(() => {
  mock.session = {
    id: sid,
    participant_id: pid,
    state: fixture(),
    version: 0,
    created_at: new Date().toISOString(),
  };
  mock.events = [];
  mock.contacts = [];
  mock.uploads.clear();
  mock.generate
    .mockReset()
    .mockResolvedValue({
      suggestions: TYPES.map((type, i) => ({
        type,
        text: `Suggestion ${i} ` + 'gentle wording '.repeat(6),
      })),
      model: 'text-test',
      responseId: 'generation-test',
      prompt: 'exact prompt',
    });
  process.env.RESEARCH_EXPORT_TOKEN = 'a'.repeat(40);
});
describe('server route protocol with mocked external providers', () => {
  it('runs 15 suggestions, blocks skipped responses/check-ins, alternates, then stops safely', async () => {
    for (let r = 0; r < 3; r++) {
      expect((await request(`sessions/${sid}/round`, {})).status).toBe(200);
      const round = mock.session!.state.rounds.at(-1)!;
      expect(round.eye).toBe(r % 2 ? 'open' : 'closed');
      expect(new Set(round.order)).toEqual(new Set(TYPES));
      expect((await request(`sessions/${sid}/round`, {})).status).toBe(409);
      for (let i = 0; i < 5; i++) {
        const x = round.suggestions[i];
        const base = `sessions/${sid}/suggestions/${x.id}`;
        expect((await request(`${base}/response`, { value: 0 })).status).toBe(409);
        expect((await request(`${base}/audio`, {})).status).toBe(200);
        expect((await request(`${base}/audio`)).status).toBe(200);
        expect(
          (
            await request(`${base}/events`, {
              event: 'ended',
              position: 0,
              duration: 30,
              clientAt: new Date().toISOString(),
            })
          ).status,
        ).toBe(409);
        for (const event of ['play', 'pause', 'seeked', 'ended'])
          expect(
            (
              await request(`${base}/events`, {
                event,
                position: 30,
                duration: 30,
                clientAt: new Date().toISOString(),
              })
            ).status,
          ).toBe(200);
        expect((await request(`${base}/response`, { value: i === 0 ? null : 0 })).status).toBe(200);
        expect((await request(`${base}/response`, { value: 10 })).status).toBe(409);
      }
    }
    expect((await request(`sessions/${sid}/round`, {})).status).toBe(409);
    expect((await request(`sessions/${sid}/intensity`, { ratings: { Fear: 0 } })).status).toBe(400);
    expect(
      (await request(`sessions/${sid}/intensity`, { ratings: { Fear: 0, Stress: 0 } })).status,
    ).toBe(200);
    expect((await request(`sessions/${sid}/round`, {})).status).toBe(200);
    expect((await request(`sessions/${sid}/stop`, {})).status).toBe(200);
    expect((await request(`sessions/${sid}/round`, {})).status).toBe(409);
    expect(mock.events.filter((e) => e === 'usefulness_response')).toHaveLength(15);
    expect(mock.session!.state.rounds[0].suggestions[0].audioSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(mock.session!.state.rounds[0].prompt).toBe('exact prompt');
  });
  it('releases failed generation leases and never overwrites a concurrent stop', async () => {
    mock.generate.mockRejectedValueOnce(new Error('provider'));
    expect((await request(`sessions/${sid}/round`, {})).status).toBe(502);
    expect(mock.session!.state.generation).toBeUndefined();
    mock.generate.mockImplementationOnce(async () => {
      await request(`sessions/${sid}/stop`, {});
      return {
        suggestions: TYPES.map((type) => ({ type, text: 'test' })),
        model: 'test',
        responseId: 'test',
        prompt: 'test',
      };
    });
    expect((await request(`sessions/${sid}/round`, {})).status).toBe(409);
    expect(mock.session!.state.status).toBe('stopped');
    expect(mock.session!.state.rounds).toHaveLength(0);
  });
  it('does not accept feedback during rounds or without separate consent', async () => {
    expect(
      (await request(`sessions/${sid}/feedback`, { email: 'a@example.test', consent: true }))
        .status,
    ).toBe(409);
    await request(`sessions/${sid}/stop`, {});
    expect(
      (await request(`sessions/${sid}/feedback`, { email: 'a@example.test', consent: false }))
        .status,
    ).toBe(400);
    expect(mock.contacts).toHaveLength(0);
    expect(
      (await request(`sessions/${sid}/feedback`, { email: 'a@example.test', consent: true }))
        .status,
    ).toBe(200);
    expect(mock.contacts).toHaveLength(1);
  });
  it('denies other sessions, unknown routes, cross-site writes, and unauthorised export', async () => {
    expect((await request('sessions/00000000-0000-4000-8000-000000000099/stop', {})).status).toBe(
      404,
    );
    expect((await request('research/export')).status).toBe(401);
    expect((await request('unknown', {})).status).toBe(404);
    const r = await handle(
      new Request(`https://pilot.test/api/sessions/${sid}/stop`, {
        method: 'POST',
        headers: { origin: 'https://other.test' },
      }),
      ['sessions', sid, 'stop'],
    );
    expect(r.status).toBe(403);
  });
});
