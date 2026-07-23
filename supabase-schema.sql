-- =====================================================================
--  SCHEMA DATABASE per "Sito Pietro"
--  Come usarlo: Supabase → SQL Editor → New query → incolla tutto → Run
-- =====================================================================

-- ---------- TABELLE ----------

create table if not exists locations (
  id          bigint generated always as identity primary key,
  lat         double precision not null,
  lon         double precision not null,
  altitude    double precision,
  accuracy    double precision,
  battery     int,
  speed       double precision,
  recorded_at timestamptz not null,
  created_at  timestamptz default now()
);
create index if not exists locations_recorded_at_idx on locations (recorded_at);

create table if not exists photos (
  id         bigint generated always as identity primary key,
  url        text not null,
  caption    text,
  taken_at   timestamptz,
  lat        double precision,
  lon        double precision,
  place      text,
  created_at timestamptz default now()
);

create table if not exists diary (
  id         bigint generated always as identity primary key,
  title      text,
  body       text not null,
  created_at timestamptz default now()
);

-- ---------- SICUREZZA (RLS) ----------
-- Lettura pubblica per tutti; scrittura pubblica solo per foto e diario.
-- Le posizioni le scrive solo il server (service role), quindi niente policy di insert.

alter table locations enable row level security;
alter table photos    enable row level security;
alter table diary     enable row level security;

drop policy if exists "read locations" on locations;
drop policy if exists "read photos"    on photos;
drop policy if exists "read diary"     on diary;
drop policy if exists "insert photos"  on photos;
drop policy if exists "insert diary"   on diary;
drop policy if exists "delete photos"  on photos;

create policy "read locations" on locations for select using (true);
create policy "read photos"    on photos    for select using (true);
create policy "read diary"     on diary     for select using (true);
create policy "insert photos"  on photos    for insert with check (true);
create policy "insert diary"   on diary     for insert with check (true);
create policy "delete photos"  on photos    for delete using (true);

-- ---------- STORAGE (bucket foto pubblico) ----------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "read photos storage"   on storage.objects;
drop policy if exists "upload photos storage" on storage.objects;
drop policy if exists "delete photos storage" on storage.objects;

create policy "read photos storage" on storage.objects
  for select using (bucket_id = 'photos');

create policy "upload photos storage" on storage.objects
  for insert to anon with check (bucket_id = 'photos');

create policy "delete photos storage" on storage.objects
  for delete to anon using (bucket_id = 'photos');
