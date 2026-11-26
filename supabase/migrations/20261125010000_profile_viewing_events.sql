begin;

create table public.viewing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id bigint not null check (tmdb_id > 0),
  media_title text not null, poster_path text, genre_ids integer[] not null default '{}',
  watched_at timestamptz not null default now(),
  kind text not null check (kind in ('initial', 'rewatch')),
  request_id uuid,
  check ((kind = 'rewatch') = (request_id is not null)),
  unique (user_id, request_id)
);
create unique index viewing_events_initial_idx on public.viewing_events(user_id, media_type, tmdb_id) where kind = 'initial';
create index viewing_events_user_date_idx on public.viewing_events(user_id, watched_at desc, id desc);
alter table public.viewing_events enable row level security;
create policy viewing_events_read_own on public.viewing_events for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.viewing_events from anon, authenticated;
grant select on public.viewing_events to authenticated;

-- Keep writes to the watched marks synchronized with the snapshot and new trigger.
lock table public.watched in share row exclusive mode;

insert into public.viewing_events(user_id, media_type, tmdb_id, media_title, poster_path, genre_ids, watched_at, kind)
select user_id, media_type, tmdb_id, media_title, poster_path, genre_ids, watched_at, 'initial' from public.watched;

-- Removing a watched mark undoes its initial event, retaining explicit rewatches.
create function public.sync_initial_viewing_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.viewing_events(user_id, media_type, tmdb_id, media_title, poster_path, genre_ids, watched_at, kind)
    values(new.user_id, new.media_type, new.tmdb_id, new.media_title, new.poster_path, new.genre_ids, new.watched_at, 'initial')
    on conflict (user_id, media_type, tmdb_id) where kind = 'initial' do nothing;
    return new;
  end if;
  delete from public.viewing_events where user_id = old.user_id and media_type = old.media_type and tmdb_id = old.tmdb_id and kind = 'initial';
  return old;
end $$;
create trigger watched_viewing_event after insert or delete on public.watched for each row execute function public.sync_initial_viewing_event();
revoke all on function public.sync_initial_viewing_event() from public, anon, authenticated;

create function public.record_rewatch(p_media_type text, p_tmdb_id bigint, p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare item public.watched%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_request_id is null or p_media_type not in ('movie', 'tv') or p_tmdb_id is null or p_tmdb_id <= 0 then
    raise exception 'Invalid viewing' using errcode = '22023';
  end if;
  if exists (select 1 from public.viewing_events where user_id = auth.uid() and request_id = p_request_id) then
    if not exists (select 1 from public.viewing_events where user_id = auth.uid() and request_id = p_request_id and media_type = p_media_type and tmdb_id = p_tmdb_id) then
      raise exception 'Request already used' using errcode = '22023';
    end if;
    return;
  end if;
  select * into item from public.watched where user_id = auth.uid() and media_type = p_media_type and tmdb_id = p_tmdb_id for update;
  if not found then raise exception 'Title is not marked watched' using errcode = '22023'; end if;
  insert into public.viewing_events(user_id, media_type, tmdb_id, media_title, poster_path, genre_ids, kind, request_id)
  values(item.user_id, item.media_type, item.tmdb_id, item.media_title, item.poster_path, item.genre_ids, 'rewatch', p_request_id)
  on conflict (user_id, request_id) do nothing;
  if not exists (select 1 from public.viewing_events where user_id = auth.uid() and request_id = p_request_id and media_type = p_media_type and tmdb_id = p_tmdb_id) then
    raise exception 'Request already used' using errcode = '22023';
  end if;
end $$;
revoke all on function public.record_rewatch(text,bigint,uuid) from public, anon;
grant execute on function public.record_rewatch(text,bigint,uuid) to authenticated;

create function public.profile_viewing_titles(p_period text default 'all', p_ranking boolean default false, p_limit integer default 12, p_offset integer default 0, p_type text default 'all')
returns table(media_type text, tmdb_id bigint, media_title text, poster_path text, genre_ids integer[], last_watched_at timestamptz, watch_count bigint, total_count bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_period not in ('all', '30d', '90d') or p_type not in ('all', 'movie', 'tv') then raise exception 'Invalid filter' using errcode = '22023'; end if;
  return query
  with filtered as (
    select e.* from public.viewing_events e where e.user_id = auth.uid() and (p_type = 'all' or e.media_type = p_type)
    and (p_period = 'all' or e.watched_at >= now() - case when p_period = '30d' then interval '30 days' else interval '90 days' end)
  ), grouped as (
    select f.media_type, f.tmdb_id, count(*) as n, max(f.watched_at) as latest
    from filtered f group by f.media_type, f.tmdb_id having not p_ranking or count(*) >= 2
  ), rows as (
    select g.media_type, g.tmdb_id, e.media_title, e.poster_path, e.genre_ids, g.latest, g.n
    from grouped g cross join lateral (select f.media_title, f.poster_path, f.genre_ids from filtered f
      where f.media_type = g.media_type and f.tmdb_id = g.tmdb_id order by f.watched_at desc, f.id desc limit 1) e
  )
  select r.media_type, r.tmdb_id, r.media_title, r.poster_path, r.genre_ids, r.latest, r.n, count(*) over()
  from rows r order by case when p_ranking then r.n end desc, r.latest desc, r.media_type, r.tmdb_id
  limit greatest(1, least(coalesce(p_limit,12), 50)) offset greatest(0, least(coalesce(p_offset,0), 10000));
end $$;
create function public.profile_viewing_stats(p_period text default 'all')
returns table(movie_count bigint, series_count bigint, genre_counts jsonb)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_period not in ('all', '30d', '90d') then raise exception 'Invalid period' using errcode = '22023'; end if;
  return query with titles as (
    select distinct on (e.media_type, e.tmdb_id) e.media_type, e.genre_ids
    from public.viewing_events e where e.user_id = auth.uid()
      and (p_period = 'all' or e.watched_at >= now() - case when p_period = '30d' then interval '30 days' else interval '90 days' end)
    order by e.media_type, e.tmdb_id, e.watched_at desc, e.id desc
  ) select (select count(*) from titles where media_type = 'movie'),
    (select count(*) from titles where media_type = 'tv'),
    (select coalesce(jsonb_object_agg(genre_id::text, n), '{}'::jsonb) from
      (select genre_id, count(*) n from titles t cross join lateral (select distinct unnest(t.genre_ids) genre_id) g group by genre_id) genres);
end $$;
revoke all on function public.profile_viewing_titles(text,boolean,integer,integer,text), public.profile_viewing_stats(text) from public, anon;
grant execute on function public.profile_viewing_titles(text,boolean,integer,integer,text), public.profile_viewing_stats(text) to authenticated;

commit;
