import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  await db.exec(readFileSync('supabase/migrations/202611150001_pilot.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202611160001_wav_lead_in.sql', 'utf8'));
});
afterAll(async () => {
  await db?.close();
});
describe('database access and atomicity', () => {
  it('denies direct reads/writes and RPCs to anonymous and authenticated clients', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        for (const table of [
          'participants',
          'sessions',
          'research_events',
          'identity_tokens',
          'email_requests',
          'rate_limits',
        ])
          await expect(db.query(`select * from public.${table}`)).rejects.toThrow(
            /permission denied/,
          );
        await expect(db.query(`select public.create_identity('x')`)).rejects.toThrow(
          /permission denied/,
        );
      } finally {
        await db.exec('reset role');
      }
    }
  });
  it('enables RLS on every research and credential table and creates a private bucket', async () => {
    const r = await db.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class where relname in ('participants','identity_tokens','sessions','research_events','email_requests','rate_limits')`,
    );
    expect(r.rows).toHaveLength(6);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
    const b = await db.query<{ public: boolean }>(`select public from storage.buckets`);
    expect(b.rows[0].public).toBe(false);
  });
  it('commits state and events together, rejects stale versions and wrong ownership', async () => {
    await db.exec('set role service_role');
    try {
      const p = (await db.query<{ id: string }>(`select public.create_identity('hash-one') id`))
        .rows[0].id;
      const other = (await db.query<{ id: string }>(`select public.create_identity('hash-two') id`))
        .rows[0].id;
      const id = (
        await db.query<{ id: string }>(
          `insert into public.sessions(participant_id,state) values ($1,'{"status":"active"}') returning id`,
          [p],
        )
      ).rows[0].id;
      const commit = (owner: string, v: number, status: string) =>
        db.query<{ ok: boolean }>(
          `select public.commit_session($1,$2,$3,$4::jsonb,'test','{}') ok`,
          [id, owner, v, JSON.stringify({ status })],
        );
      expect((await commit(other, 0, 'stopped')).rows[0].ok).toBe(false);
      expect((await commit(p, 0, 'stopped')).rows[0].ok).toBe(true);
      expect((await commit(p, 0, 'active')).rows[0].ok).toBe(false);
      const s = await db.query<{ version: number; state: { status: string } }>(
        `select version,state from public.sessions where id=$1`,
        [id],
      );
      expect(s.rows[0]).toEqual({ version: 1, state: { status: 'stopped' } });
      expect(
        (await db.query(`select * from public.research_events where session_id=$1`, [id])).rows,
      ).toHaveLength(1);
      await expect(commit(p, 1, 'invalid')).rejects.toThrow();
      expect(
        (await db.query(`select * from public.research_events where session_id=$1`, [id])).rows,
      ).toHaveLength(1);
    } finally {
      await db.exec('reset role');
    }
  });
  it('prevents two active sessions per participant', async () => {
    const p = (await db.query<{ id: string }>(`select public.create_identity('unique-test') id`))
      .rows[0].id;
    await db.query(
      `insert into public.sessions(participant_id,state) values($1,'{"status":"active"}')`,
      [p],
    );
    await expect(
      db.query(
        `insert into public.sessions(participant_id,state) values($1,'{"status":"active"}')`,
        [p],
      ),
    ).rejects.toThrow(/unique/);
  });
  it('uses persistent atomic rate limits', async () => {
    for (let n = 0; n < 4; n++) {
      const result = await db.query<{ ok: boolean }>(
        `select public.take_rate_limit('test',2,3600) ok`,
      );
      expect(result.rows[0].ok).toBe(n < 2);
    }
  });
});
