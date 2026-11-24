alter table public.reviews add column body_document jsonb;
alter table public.reviews add constraint reviews_body_document_shape check (
  body_document is null or (
    jsonb_typeof(body_document) = 'object'
    and coalesce(jsonb_typeof(body_document->'blocks') = 'array', false)
    and octet_length(body_document::text) <= 100000
  )
);

drop function public.following_feed(timestamptz, uuid);
create function public.following_feed(p_before_created_at timestamptz default null, p_before_id uuid default null)
returns table (id uuid, media_type text, tmdb_id bigint, rating integer, body text, body_document jsonb,
  youtube_video_id text, created_at timestamptz, display_name text, handle text, avatar_url text)
language sql stable security invoker set search_path = public
as $$
  select r.id, r.media_type, r.tmdb_id, r.rating, r.body, r.body_document, r.youtube_video_id,
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

drop function public.title_reviews_followed_first(text,bigint,uuid,integer);
create function public.title_reviews_followed_first(
  p_media_type text, p_tmdb_id bigint, p_highlighted_review_id uuid, p_limit integer
) returns table (
  id uuid, rating integer, body text, body_document jsonb, youtube_video_id text,
  user_id uuid, created_at timestamptz, display_name text, handle text, avatar_url text
)
language sql stable security invoker set search_path = '' as $$
  with ranked as (
    select r.id, r.rating, r.body, r.body_document, r.youtube_video_id, r.user_id, r.created_at,
           p.display_name, p.handle, p.avatar_url,
           (f.following_id is not null) as followed
    from public.reviews r
    left join public.profiles p on p.id = r.user_id
    left join public.follows f on f.following_id = r.user_id
      and f.follower_id = (select auth.uid())
    where r.media_type = p_media_type and r.tmdb_id = p_tmdb_id
  ), first_page as (
    select * from ranked order by followed desc, created_at desc, id desc
    limit least(greatest(coalesce(p_limit, 1000), 1), 1000)
  ), visible as (
    select * from first_page
    union all
    select * from ranked r where r.id = p_highlighted_review_id
      and not exists (select 1 from first_page first where first.id = r.id)
  )
  select id, rating, body, body_document, youtube_video_id, user_id, created_at, display_name, handle, avatar_url
  from visible order by followed desc, created_at desc, id desc
$$;
revoke all on function public.title_reviews_followed_first(text,bigint,uuid,integer) from public;
grant execute on function public.title_reviews_followed_first(text,bigint,uuid,integer) to anon, authenticated;
