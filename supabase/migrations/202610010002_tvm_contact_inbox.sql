-- Private inbox; visitors can submit through a restricted RPC, never read it.
create table public.tvm_contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  video_id text references public.tvm_videos(id) on delete set null,
  recording jsonb not null,
  name text not null check (length(trim(name)) between 1 and 100),
  email text not null check (length(trim(email)) between 3 and 254),
  message text not null check (length(trim(message)) between 1 and 5000),
  reviewed_at timestamptz
);
create index tvm_contact_messages_created on public.tvm_contact_messages(created_at desc);
create index tvm_contact_messages_new on public.tvm_contact_messages(created_at desc) where reviewed_at is null;
alter table public.tvm_contact_messages enable row level security;
revoke all on public.tvm_contact_messages from public, anon, authenticated;
grant select, update(reviewed_at) on public.tvm_contact_messages to authenticated;
create policy tvm_contact_read_admin on public.tvm_contact_messages for select to authenticated
  using ((select public.tvm_is_admin()));
create policy tvm_contact_review_admin on public.tvm_contact_messages for update to authenticated
  using ((select public.tvm_is_admin())) with check ((select public.tvm_is_admin()));

create function public.tvm_submit_contact(p_video_id text, p_name text, p_email text, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  details jsonb;
  saved_id uuid;
begin
  if p_name is null or length(trim(p_name)) not between 1 and 100
     or p_email is null or length(trim(p_email)) not between 3 and 254
     or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_message is null or length(trim(p_message)) not between 1 and 5000 then
    raise exception 'Enter a name, valid email, and message.' using errcode = '22023';
  end if;
  -- Resolve context from the canonical published record, not visitor-supplied metadata.
  select jsonb_build_object('id', v.id, 'slug', v.slug, 'title', v.title,
    'year', v.year, 'dvdLabel', d.label) into details
  from public.tvm_videos v left join public.tvm_dvds d on d.slug = v."dvdSlug"
  where v.id = p_video_id and v.status = 'published' and v.ready;
  if details is null then
    raise exception 'This recording is no longer accepting submissions.' using errcode = '22023';
  end if;
  insert into public.tvm_contact_messages(video_id, recording, name, email, message)
  values (p_video_id, details, trim(p_name), trim(p_email), trim(p_message)) returning id into saved_id;
  return saved_id;
end;
$$;
revoke all on function public.tvm_submit_contact(text, text, text, text) from public;
grant execute on function public.tvm_submit_contact(text, text, text, text) to anon, authenticated;
