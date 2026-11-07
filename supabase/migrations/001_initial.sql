-- GRANTLY cloud schema (NOT ACTIVE in the deployed build — the app ships in
-- on-device demo mode). Provided so cloud mode can be enabled later with
-- Supabase anonymous auth. This migration has not been applied or tested
-- against a live project; verify RLS with two anonymous sessions before use.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  scholarship_id text not null check (char_length(scholarship_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, scholarship_id)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scholarship_id text not null check (char_length(scholarship_id) between 1 and 120),
  program_id text not null check (char_length(program_id) between 1 and 120),
  status text not null default 'preparing'
    check (status in ('preparing','submitted','waiting','action-required','awarded','not-selected','withdrawn')),
  closes_on date,
  submitted_at timestamptz,
  award_confirmed_usd numeric(12,2) check (award_confirmed_usd is null or award_confirmed_usd >= 0),
  award_evidence text not null default 'none' check (award_evidence in ('student-reported','provider-confirmed','none')),
  offer_response_status text check (offer_response_status in ('pending','accepted','declined')),
  offer_response_deadline_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scholarship_id, program_id),
  unique (id, user_id)
);
create index if not exists applications_user_updated on public.applications (user_id, updated_at desc);

create table if not exists public.application_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  application_id uuid not null,
  task_key text not null check (char_length(task_key) between 1 and 120),
  label text not null check (char_length(label) <= 200),
  required boolean not null,
  type text not null check (type in ('essay','document','recommendation','form','review')),
  status text not null default 'todo' check (status in ('todo','waiting','complete')),
  due_on date,
  owner text not null check (owner in ('student','recommender','provider')),
  essay_prompt_id text,
  last_follow_up_on date,
  next_follow_up_on date,
  unique (application_id, task_key),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade
);
create index if not exists tasks_user_app_due on public.application_tasks (user_id, application_id, due_on);

create table if not exists public.story_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  situation text not null default '' check (char_length(situation) <= 1500),
  action text not null default '' check (char_length(action) <= 1500),
  result text not null default '' check (char_length(result) <= 1500),
  reflection text not null default '' check (char_length(reflection) <= 1500),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.essay_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  application_id uuid not null,
  prompt_id text not null check (char_length(prompt_id) between 1 and 120),
  selected_story_ids uuid[] not null default '{}',
  outline jsonb not null default '{}'::jsonb,
  body text not null default '' check (char_length(body) <= 20000),
  user_marked_ready boolean not null default false,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, prompt_id),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade
);
create index if not exists essays_user_app on public.essay_drafts (user_id, application_id);

-- Row level security: every user-owned table, owner-only, authenticated role only.
do $$
declare t text;
begin
  foreach t in array array['profiles','bookmarks','applications','application_tasks','story_bank','essay_drafts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- Compare-and-swap essay save: returns no row when expected_revision is stale (map to HTTP 409).
create or replace function public.save_essay_draft(
  p_application_id uuid, p_prompt_id text, p_body text, p_outline jsonb,
  p_story_ids uuid[], p_ready boolean, p_expected_revision integer
) returns public.essay_drafts
language plpgsql security invoker as $$
declare result public.essay_drafts;
begin
  if p_expected_revision = 0 then
    insert into public.essay_drafts (user_id, application_id, prompt_id, body, outline, selected_story_ids, user_marked_ready, revision)
    values (auth.uid(), p_application_id, p_prompt_id, p_body, p_outline, p_story_ids, p_ready, 1)
    on conflict (application_id, prompt_id) do nothing
    returning * into result;
  else
    update public.essay_drafts
      set body = p_body, outline = p_outline, selected_story_ids = p_story_ids,
          user_marked_ready = p_ready, revision = revision + 1, updated_at = now()
      where application_id = p_application_id and prompt_id = p_prompt_id
        and user_id = auth.uid() and revision = p_expected_revision
      returning * into result;
  end if;
  return result;
end $$;
