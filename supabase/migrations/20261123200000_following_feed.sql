create index reviews_feed_idx on public.reviews (user_id, created_at desc, id desc);

create function public.following_feed(p_before_created_at timestamptz default null, p_before_id uuid default null)
returns table (id uuid, media_type text, tmdb_id bigint, rating integer, body text,
  youtube_video_id text, created_at timestamptz, display_name text, handle text, avatar_url text)
language sql stable security invoker set search_path = public
as $$
  select r.id, r.media_type, r.tmdb_id, r.rating, r.body, r.youtube_video_id,
    r.created_at, p.display_name, p.handle, p.avatar_url
  from public.follows f
  join public.reviews r on r.user_id = f.following_id
  join public.profiles p on p.id = r.user_id
  where f.follower_id = (select auth.uid())
    and ((p_before_created_at is null and p_before_id is null)
      or (p_before_created_at is not null and p_before_id is not null
          and (r.created_at, r.id) < (p_before_created_at, p_before_id)))
  order by r.created_at desc, r.id desc
  limit 13;
$$;
revoke all on function public.following_feed(timestamptz, uuid) from public, anon;
grant execute on function public.following_feed(timestamptz, uuid) to authenticated;
