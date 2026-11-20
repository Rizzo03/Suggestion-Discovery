-- Research and identity tables are inaccessible to anon/authenticated roles.
-- All participant access passes through server-side ownership checks.
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  recovery_hash text unique,
  created_at timestamptz not null default now()
);
create table public.identity_tokens (
  token_hash text primary key,
  participant_id uuid not null references public.participants(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);
create index on public.identity_tokens(participant_id);
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  state jsonb not null check (state->>'status' in ('active','stopped')),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.sessions(participant_id, created_at desc);
create unique index one_active_session on public.sessions(participant_id) where state->>'status' = 'active';
comment on column public.sessions.state is 'Versioned study document: exact prompts, AI metadata, immutable randomisation records, ordered rounds and suggestions, baseline/repeated intensity ratings, usefulness responses, completion timestamps.';
create table public.research_events (
  id bigint generated always as identity primary key,
  participant_id uuid not null references public.participants(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  event text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.research_events(session_id, id);
create table public.email_requests (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  encrypted_email text not null,
  consent_version text not null,
  consent_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','sending','sent','cancelled')),
  sent_at timestamptz,
  provider_id text
);
create table public.rate_limits (
  key text primary key,
  count integer not null,
  resets_at timestamptz not null
);

create function public.create_identity(p_hash text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare p uuid;
begin
  insert into public.participants default values returning id into p;
  insert into public.identity_tokens(token_hash, participant_id) values (p_hash, p);
  return p;
end $$;

-- CAS prevents two tabs from advancing a session, duplicating a rating, or
-- overwriting a stop with a delayed AI response. Events commit atomically.
create function public.commit_session(p_id uuid, p_participant uuid, p_version integer, p_state jsonb, p_event text, p_payload jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.sessions set state=p_state, version=version+1, updated_at=now()
  where id=p_id and participant_id=p_participant and version=p_version;
  if not found then return false; end if;
  insert into public.research_events(participant_id, session_id, event, payload)
  values (p_participant,p_id,p_event,p_payload);
  return true;
end $$;
create function public.take_rate_limit(p_key text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  insert into public.rate_limits as r(key,count,resets_at)
  values (p_key,1,now()+make_interval(secs=>p_seconds))
  on conflict(key) do update set
    count=case when r.resets_at <= now() then 1 else r.count+1 end,
    resets_at=case when r.resets_at <= now() then now()+make_interval(secs=>p_seconds) else r.resets_at end
  returning count into n;
  return n <= p_limit;
end $$;

alter table public.participants enable row level security;
alter table public.identity_tokens enable row level security;
alter table public.sessions enable row level security;
alter table public.research_events enable row level security;
alter table public.email_requests enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.participants,public.identity_tokens,public.sessions,public.research_events,public.email_requests,public.rate_limits from public,anon,authenticated;
grant all on public.participants,public.identity_tokens,public.sessions,public.research_events,public.email_requests,public.rate_limits to service_role;
grant usage,select on sequence public.research_events_id_seq to service_role;
revoke all on function public.create_identity(text),public.commit_session(uuid,uuid,integer,jsonb,text,jsonb),public.take_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.create_identity(text),public.commit_session(uuid,uuid,integer,jsonb,text,jsonb),public.take_rate_limit(text,integer,integer) to service_role;

-- Generated audio is never public or served as a public signed URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('suggestion-audio','suggestion-audio',false,10485760,array['audio/mpeg'])
on conflict(id) do nothing;
