create function public.movie_review_page(p_tmdb_id bigint, p_after_followed boolean default null, p_after_created_at timestamptz default null, p_after_id uuid default null, p_limit integer default 21)
returns table (id uuid, rating integer, body text, body_document jsonb, youtube_video_id text, user_id uuid, created_at timestamptz, display_name text, handle text, avatar_url text, followed boolean)
language sql stable security invoker set search_path = '' as $$
  select r.id, r.rating, r.body, r.body_document, r.youtube_video_id, r.user_id, r.created_at, p.display_name, p.handle, p.avatar_url, (f.following_id is not null) as followed
  from public.reviews r
  left join public.profiles p on p.id = r.user_id
  left join public.follows f on f.following_id = r.user_id and f.follower_id = (select auth.uid())
  where r.media_type = 'movie' and r.tmdb_id = p_tmdb_id
    and (p_after_id is null or ((f.following_id is not null), r.created_at, r.id) < (p_after_followed, p_after_created_at, p_after_id))
  order by followed desc, r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 21), 1), 21)
$$;
revoke all on function public.movie_review_page(bigint, boolean, timestamptz, uuid, integer) from public;
grant execute on function public.movie_review_page(bigint, boolean, timestamptz, uuid, integer) to anon, authenticated;
