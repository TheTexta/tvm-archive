-- TVM tables are isolated from existing gallery tables. Apply explicitly.
create table public.tvm_admin_users (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.tvm_admin_users enable row level security;
create or replace function public.tvm_is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.tvm_admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.tvm_is_admin() from public;
grant execute on function public.tvm_is_admin() to authenticated;
create table public.tvm_dvds (
 slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 label text not null check (length(trim(label)) > 0), year integer check (year between 1900 and 2100),
 notes text not null default '', cover text
);
create table public.tvm_videos (
 id text primary key, slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 title text not null check (length(trim(title)) > 0), year integer check (year between 1900 and 2100),
 category text not null default 'Campus life', description text not null default '', tags text[] not null default '{}',
 "dvdSlug" text references public.tvm_dvds(slug), duration integer check (duration > 0),
 poster text not null default '', source jsonb not null check (source->>'type' in ('mp4','youtube')),
 "sourceUrl" text not null default '', "addedAt" timestamptz not null default now(),
 status text not null default 'draft' check (status in ('draft','published')), ready boolean not null default false,
 playback_key text, poster_key text
);
alter table public.tvm_dvds enable row level security;
alter table public.tvm_videos enable row level security;
create policy tvm_dvds_admin on public.tvm_dvds for all to authenticated using ((select public.tvm_is_admin())) with check ((select public.tvm_is_admin()));
create policy tvm_videos_admin on public.tvm_videos for all to authenticated using ((select public.tvm_is_admin())) with check ((select public.tvm_is_admin()));
grant select, insert, update, delete on public.tvm_dvds, public.tvm_videos to authenticated;
-- Public users read only the exported snapshot. No anonymous DB access is granted.

-- One statement supplies one consistent snapshot for all generated pages.
create or replace function public.tvm_export_catalogue() returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'revision', 'tvm-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
  'videos', coalesce((select jsonb_agg(to_jsonb(v) - 'status' - 'ready' - 'playback_key' - 'poster_key' order by v."addedAt" desc) from public.tvm_videos v where status = 'published' and ready), '[]'::jsonb),
  'dvds', coalesce((select jsonb_agg(to_jsonb(d) order by d.label) from public.tvm_dvds d where exists(select 1 from public.tvm_videos v where v."dvdSlug" = d.slug and v.status = 'published' and v.ready)), '[]'::jsonb)
 );
$$;
revoke all on function public.tvm_export_catalogue() from public, anon, authenticated;
grant execute on function public.tvm_export_catalogue() to service_role;
