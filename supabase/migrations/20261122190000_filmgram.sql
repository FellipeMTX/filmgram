create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now()
);
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id), check (follower_id <> following_id)
);
create index follows_following_idx on public.follows(following_id);
create table public.title_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  tmdb_id bigint not null check (tmdb_id > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, media_type, tmdb_id)
);
create index title_likes_title_idx on public.title_likes(media_type, tmdb_id);
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  tmdb_id bigint not null check (tmdb_id > 0),
  media_title text not null, poster_path text, genre_ids integer[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, media_type, tmdb_id)
);
create table public.watched (
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  tmdb_id bigint not null check (tmdb_id > 0),
  media_title text not null, poster_path text, genre_ids integer[] not null default '{}',
  watched_at timestamptz not null default now(),
  primary key (user_id, media_type, tmdb_id)
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  tmdb_id bigint not null check (tmdb_id > 0),
  rating integer not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 10000),
  youtube_video_id text check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, media_type, tmdb_id)
);
create index reviews_title_idx on public.reviews(media_type,tmdb_id,created_at desc);
create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text check (description is null or char_length(description) <= 2000),
  is_public boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index playlists_user_idx on public.playlists(user_id);
create table public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  tmdb_id bigint not null check (tmdb_id > 0),
  position integer not null check (position >= 0),
  media_title text not null, poster_path text,
  created_at timestamptz not null default now(),
  unique (playlist_id, media_type, tmdb_id),
  constraint playlist_items_position_unique unique (playlist_id, position) deferrable initially immediate
);

-- UUID-derived suffix makes collisions safe even when two signups race. Retry on
-- the unlikely event that a manually chosen handle occupies the candidate.
create function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text; candidate text; n integer := 0;
begin
  base := lower(coalesce(new.raw_user_meta_data->>'handle', split_part(coalesce(new.email,''),'@',1), 'user'));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if length(base) < 3 then base := 'user'; end if;
  base := left(base, 17);
  loop
    candidate := base || '_' || left(replace(new.id::text, '-', ''), 8) || case when n = 0 then '' else '_' || n::text end;
    begin
      insert into public.profiles(id,handle,display_name)
      values(new.id, left(candidate,30), left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''), base),80));
      exit;
    exception when unique_violation then
      n := n + 1;
      if n > 100 then raise; end if;
    end;
  end loop;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile_for_user();
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();
create trigger playlists_touch before update on public.playlists for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.title_likes enable row level security;
alter table public.favorites enable row level security;
alter table public.watched enable row level security;
alter table public.reviews enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy follows_read on public.follows for select using (true);
create policy follows_insert on public.follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy follows_delete on public.follows for delete to authenticated using (follower_id = (select auth.uid()));
create policy likes_own on public.title_likes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy favorites_own on public.favorites for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy watched_own on public.watched for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reviews_read on public.reviews for select using (true);
create policy reviews_insert on public.reviews for insert to authenticated with check (user_id = (select auth.uid()));
create policy reviews_update on public.reviews for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reviews_delete on public.reviews for delete to authenticated using (user_id = (select auth.uid()));
create policy playlists_read on public.playlists for select using (is_public or user_id = (select auth.uid()));
create policy playlists_insert on public.playlists for insert to authenticated with check (user_id = (select auth.uid()));
create policy playlists_update on public.playlists for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy playlists_delete on public.playlists for delete to authenticated using (user_id = (select auth.uid()));
create policy playlist_items_read on public.playlist_items for select using (exists (select 1 from public.playlists p where p.id = playlist_id and (p.is_public or p.user_id = (select auth.uid()))));
create policy playlist_items_insert on public.playlist_items for insert to authenticated with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));
create policy playlist_items_update on public.playlist_items for update to authenticated using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid()))) with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));
create policy playlist_items_delete on public.playlist_items for delete to authenticated using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));

create function public.title_like_count(p_media_type text, p_tmdb_id bigint) returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.title_likes where media_type = p_media_type and tmdb_id = p_tmdb_id
$$;
create function public.most_liked_titles(p_limit integer default 12)
returns table(media_type text, tmdb_id bigint, like_count bigint)
language sql stable security definer set search_path = '' as $$
 select l.media_type, l.tmdb_id, count(*) as like_count from public.title_likes l
 group by l.media_type, l.tmdb_id order by like_count desc, l.media_type, l.tmdb_id
 limit greatest(1, least(coalesce(p_limit, 12), 50))
$$;
create function public.profile_stats(p_profile_id uuid)
returns table(follower_count bigint, following_count bigint, review_count bigint, like_count bigint, movie_count bigint, series_count bigint, genre_counts jsonb)
language sql stable security definer set search_path = '' as $$
 select (select count(*) from public.follows where following_id = p_profile_id),
        (select count(*) from public.follows where follower_id = p_profile_id),
        (select count(*) from public.reviews where user_id = p_profile_id),
        (select count(*) from public.title_likes where user_id = p_profile_id),
        (select count(*) from public.watched where user_id = p_profile_id and media_type = 'movie'),
        (select count(*) from public.watched where user_id = p_profile_id and media_type = 'tv'),
        (select coalesce(jsonb_object_agg(genre_id::text, total), '{}'::jsonb) from
          (select genre_id, count(*) as total from public.watched w cross join lateral (select distinct unnest(w.genre_ids) as genre_id) g where w.user_id = p_profile_id group by genre_id) genres)
$$;
create function public.reorder_playlist_items(p_playlist_id uuid, p_item_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare item_count integer;
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.playlists where id = p_playlist_id and user_id = auth.uid() for update;
  if not found then raise exception 'Not authorized' using errcode = '42501'; end if;
  select count(*) into item_count from public.playlist_items where playlist_id = p_playlist_id;
  if p_item_ids is null or cardinality(p_item_ids) <> item_count
     or (select count(distinct id) from unnest(p_item_ids) as ids(id)) <> item_count
     or exists (select 1 from unnest(p_item_ids) as ids(id) where id is null or not exists (select 1 from public.playlist_items where playlist_id = p_playlist_id and playlist_items.id = ids.id)) then
    raise exception 'Item IDs must contain every playlist item exactly once' using errcode = '22023';
  end if;
  set constraints public.playlist_items_position_unique deferred;
  update public.playlist_items i set position = (ordered.ordinality - 1)::integer
    from unnest(p_item_ids) with ordinality as ordered(id, ordinality)
    where i.id = ordered.id and i.playlist_id = p_playlist_id;
end $$;
revoke all on function public.create_profile_for_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.title_like_count(text,bigint), public.profile_stats(uuid), public.most_liked_titles(integer), public.reorder_playlist_items(uuid,uuid[]) from public;
grant execute on function public.title_like_count(text,bigint), public.profile_stats(uuid), public.most_liked_titles(integer) to anon, authenticated;
grant execute on function public.reorder_playlist_items(uuid,uuid[]) to authenticated;
