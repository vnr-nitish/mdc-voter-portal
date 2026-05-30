create extension if not exists "pgcrypto";

create table if not exists voters (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  registration_number text unique not null,
  name text not null,
  email text unique not null,
  mobile_number text,
  school text,
  stream text,
  domain text,
  position text,
  stay text,
  branch text,
  year_of_study text,
  oat_score text,
  points integer not null default 1,
  vote_points integer not null default 1,
  is_verified boolean default false,
  has_voted boolean default false,
  created_at timestamptz default now()
);

create table if not exists elections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists election_voters (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) on delete cascade,
  voter_id uuid references voters(id) on delete cascade,
  is_verified boolean default false,
  has_voted boolean default false,
  created_at timestamptz default now(),
  unique (election_id, voter_id)
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) on delete cascade,
  name text not null,
  email text,
  phone_number text,
  party_symbol_url text,
  photo_url text,
  manifesto text,
  created_at timestamptz default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) on delete cascade,
  voter_id uuid references voters(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete restrict,
  points integer not null default 1,
  reason text not null,
  created_at timestamptz default now(),
  unique (election_id, voter_id)
);

create table if not exists verification_requests (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) on delete cascade,
  voter_id uuid references voters(id) on delete cascade,
  photo_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) on delete cascade,
  voter_id uuid references voters(id) on delete cascade,
  started_at timestamptz default now(),
  expires_at timestamptz not null,
  is_active boolean default true
);

create table if not exists profile_reports (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) on delete cascade,
  voter_id uuid references voters(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity text not null,
  entity_id text,
  election_id uuid,
  actor text not null default 'admin',
  metadata jsonb,
  created_at timestamptz default now()
);

alter table candidates add column if not exists election_id uuid references elections(id) on delete cascade;
alter table votes add column if not exists election_id uuid references elections(id) on delete cascade;
alter table votes add column if not exists points integer not null default 1;
alter table verification_requests add column if not exists election_id uuid references elections(id) on delete cascade;
alter table sessions add column if not exists election_id uuid references elections(id) on delete cascade;
alter table profile_reports add column if not exists election_id uuid references elections(id) on delete cascade;
alter table voters add column if not exists mobile_number text;
alter table voters add column if not exists school text;
alter table voters add column if not exists stream text;
alter table voters add column if not exists domain text;
alter table voters add column if not exists position text;
alter table voters add column if not exists stay text;
alter table voters add column if not exists points integer not null default 1;
alter table voters add column if not exists vote_points integer not null default 1;
alter table candidates add column if not exists email text;
alter table candidates add column if not exists phone_number text;

alter table voters enable row level security;
alter table elections enable row level security;
alter table election_voters enable row level security;
alter table candidates enable row level security;
alter table votes enable row level security;
alter table verification_requests enable row level security;
alter table sessions enable row level security;
alter table profile_reports enable row level security;
alter table audit_logs enable row level security;

drop policy if exists "elections read" on elections;
create policy "elections read" on elections
  for select
  using (is_active = true);

drop policy if exists "voters read own" on voters;
create policy "voters read own" on voters
  for select
  using (auth_user_id = auth.uid());

drop policy if exists "voters link auth" on voters;
create policy "voters link auth" on voters
  for update
  using (auth_user_id = auth.uid() or auth_user_id is null)
  with check (auth_user_id = auth.uid());

drop policy if exists "election voters read own" on election_voters;
create policy "election voters read own" on election_voters
  for select
  using (
    exists (
      select 1
      from voters v
      where v.id = voter_id
        and v.auth_user_id = auth.uid()
    )
  );

drop policy if exists "candidates read" on candidates;
create policy "candidates read" on candidates
  for select
  using (
    exists (
      select 1
      from election_voters ev
      join voters v on v.id = ev.voter_id
      join elections e on e.id = ev.election_id
      where ev.election_id = candidates.election_id
        and v.auth_user_id = auth.uid()
        and e.is_active = true
    )
  );

drop policy if exists "votes insert" on votes;
create policy "votes insert" on votes
  for insert
  with check (
    exists (
      select 1
      from election_voters ev
      join voters v on v.id = ev.voter_id
      join elections e on e.id = ev.election_id
      where ev.election_id = votes.election_id
        and ev.voter_id = votes.voter_id
        and v.auth_user_id = auth.uid()
        and ev.is_verified = true
        and ev.has_voted = false
        and e.is_active = true
    )
  );

drop policy if exists "votes read own" on votes;
create policy "votes read own" on votes
  for select
  using (
    exists (
      select 1
      from election_voters ev
      join voters v on v.id = ev.voter_id
      where ev.election_id = votes.election_id
        and ev.voter_id = votes.voter_id
        and v.auth_user_id = auth.uid()
    )
  );

drop policy if exists "verification request insert" on verification_requests;
create policy "verification request insert" on verification_requests
  for insert
  with check (
    exists (
      select 1
      from election_voters ev
      join voters v on v.id = ev.voter_id
      join elections e on e.id = ev.election_id
      where ev.election_id = verification_requests.election_id
        and ev.voter_id = verification_requests.voter_id
        and v.auth_user_id = auth.uid()
        and e.is_active = true
    )
  );

drop policy if exists "verification request read own" on verification_requests;
create policy "verification request read own" on verification_requests
  for select
  using (
    exists (
      select 1
      from election_voters ev
      join voters v on v.id = ev.voter_id
      where ev.election_id = verification_requests.election_id
        and ev.voter_id = verification_requests.voter_id
        and v.auth_user_id = auth.uid()
    )
  );

drop policy if exists "sessions insert" on sessions;
create policy "sessions insert" on sessions
  for insert
  with check (
    exists (
      select 1
      from election_voters ev
      join voters v on v.id = ev.voter_id
      join elections e on e.id = ev.election_id
      where ev.election_id = sessions.election_id
        and ev.voter_id = sessions.voter_id
        and v.auth_user_id = auth.uid()
        and e.is_active = true
    )
    and not exists (
      select 1
      from sessions s
      join voters v on v.id = s.voter_id
      where v.auth_user_id = auth.uid()
        and s.is_active = true
        and s.expires_at > now()
    )
  );

drop policy if exists "sessions update own" on sessions;
create policy "sessions update own" on sessions
  for update
  using (
    exists (
      select 1
      from voters v
      where v.id = sessions.voter_id
        and v.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from voters v
      where v.id = sessions.voter_id
        and v.auth_user_id = auth.uid()
    )
  );

drop policy if exists "profile reports insert" on profile_reports;
create policy "profile reports insert" on profile_reports
  for insert
  with check (
    exists (
      select 1
      from election_voters ev
      join voters v on v.id = ev.voter_id
      where ev.election_id = profile_reports.election_id
        and ev.voter_id = profile_reports.voter_id
        and v.auth_user_id = auth.uid()
    )
  );

drop policy if exists "profile reports read own" on profile_reports;
create policy "profile reports read own" on profile_reports
  for select
  using (
    exists (
      select 1
      from election_voters ev
      join voters v on v.id = ev.voter_id
      where ev.election_id = profile_reports.election_id
        and ev.voter_id = profile_reports.voter_id
        and v.auth_user_id = auth.uid()
    )
  );

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table voters to authenticated, service_role;
grant select, insert, update, delete on table elections to authenticated, service_role;
grant select, insert, update, delete on table election_voters to authenticated, service_role;
grant select, insert, update, delete on table candidates to authenticated, service_role;
grant select, insert, update, delete on table votes to authenticated, service_role;
grant select, insert, update, delete on table verification_requests to authenticated, service_role;
grant select, insert, update, delete on table sessions to authenticated, service_role;
grant select, insert, update, delete on table profile_reports to authenticated, service_role;
grant select, insert, update, delete on table audit_logs to authenticated, service_role;

-- Storage bucket policies for voter photos
-- Create bucket named "voter-photos" before applying these policies.
drop policy if exists "voter photos insert" on storage.objects;
create policy "voter photos insert" on storage.objects
  for insert
  with check (
    bucket_id = 'voter-photos'
    and auth.role() = 'authenticated'
  );

