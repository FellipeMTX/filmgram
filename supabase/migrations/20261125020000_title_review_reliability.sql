create function public.title_review_page(p_media_type text, p_tmdb_id bigint, p_after_followed boolean default null, p_after_created_at timestamptz default null, p_after_id uuid default null, p_limit integer default 21)
returns table (id uuid, rating integer, body text, body_document jsonb, youtube_video_id text, user_id uuid, created_at timestamptz, display_name text, handle text, avatar_url text, followed boolean)
language sql stable security invoker set search_path = '' as $$
  select r.id, r.rating, r.body, r.body_document, r.youtube_video_id, r.user_id, r.created_at, p.display_name, p.handle, p.avatar_url, (f.following_id is not null) as followed
  from public.reviews r
  left join public.profiles p on p.id = r.user_id
  left join public.follows f on f.following_id = r.user_id and f.follower_id = (select auth.uid())
  where r.media_type = p_media_type and r.tmdb_id = p_tmdb_id
    and (p_after_id is null or ((f.following_id is not null), r.created_at, r.id) < (p_after_followed, p_after_created_at, p_after_id))
  order by followed desc, r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 21), 1), 21)
$$;
revoke all on function public.title_review_page(text,bigint,boolean,timestamptz,uuid,integer) from public;
grant execute on function public.title_review_page(text,bigint,boolean,timestamptz,uuid,integer) to anon, authenticated;

create or replace function public.movie_review_page(p_tmdb_id bigint, p_after_followed boolean default null, p_after_created_at timestamptz default null, p_after_id uuid default null, p_limit integer default 21)
returns table (id uuid, rating integer, body text, body_document jsonb, youtube_video_id text, user_id uuid, created_at timestamptz, display_name text, handle text, avatar_url text, followed boolean)
language sql stable security invoker set search_path = '' as $$
  select * from public.title_review_page(
    'movie', p_tmdb_id, p_after_followed, p_after_created_at, p_after_id, p_limit
  )
$$;

-- Keep request metadata separate from comments, which anyone can read.
create schema if not exists private;

create table private.review_comment_attempts (
  author_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null,
  comment_id uuid not null unique references public.review_comments(id) on delete cascade,
  target_comment_id uuid,
  primary key (author_id, attempt_id)
);
alter table private.review_comment_attempts enable row level security;
revoke all on table private.review_comment_attempts from public, anon, authenticated;

create function public.create_review_comment_with_mention(
  p_review_id uuid, p_target_comment_id uuid, p_body text, p_attempt_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_author_id uuid := auth.uid();
  v_comment_id uuid;
  v_review_id uuid;
  v_target_comment_id uuid;
  v_mentioned_profile_id uuid;
begin
  if v_author_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then
    raise exception 'Invalid comment' using errcode = '22023';
  end if;

  if p_attempt_id is not null then
    -- Wait for any in-flight submission of this attempt before looking it up.
    perform pg_advisory_xact_lock(hashtextextended(
      'review-comment:' || v_author_id::text || ':' || p_attempt_id::text, 0
    ));

    select c.id, c.review_id, a.target_comment_id
      into v_comment_id, v_review_id, v_target_comment_id
    from private.review_comment_attempts a
    join public.review_comments c on c.id = a.comment_id
    where a.author_id = v_author_id and a.attempt_id = p_attempt_id;

    if found then
      if p_review_id is distinct from v_review_id
         or p_target_comment_id is distinct from v_target_comment_id then
        raise exception 'Comment attempt is for a different destination' using errcode = '22023';
      end if;
      -- Replays return the original ID even after an edit or soft deletion.
      return v_comment_id;
    end if;
  end if;

  if p_target_comment_id is not null then
    select c.user_id into v_mentioned_profile_id
    from public.review_comments c
    where c.id = p_target_comment_id and c.review_id = p_review_id
      and c.deleted_at is null and c.user_id is not null
    for share;
    if not found then
      raise exception 'Invalid mention target' using errcode = '22023';
    end if;
  end if;

  insert into public.review_comments (review_id, user_id, mentioned_profile_id, body)
  values (p_review_id, v_author_id, v_mentioned_profile_id, btrim(p_body))
  returning id into v_comment_id;

  if p_attempt_id is not null then
    insert into private.review_comment_attempts (author_id, attempt_id, comment_id, target_comment_id)
    values (v_author_id, p_attempt_id, v_comment_id, p_target_comment_id);
  end if;

  return v_comment_id;
end $$;
revoke all on function public.create_review_comment_with_mention(uuid,uuid,text,uuid) from public, anon;
grant execute on function public.create_review_comment_with_mention(uuid,uuid,text,uuid) to authenticated;

create or replace function public.create_review_comment_with_mention(
  p_review_id uuid, p_target_comment_id uuid, p_body text
) returns uuid
language sql security invoker set search_path = '' as $$
  select public.create_review_comment_with_mention(p_review_id, p_target_comment_id, p_body, null)
$$;
