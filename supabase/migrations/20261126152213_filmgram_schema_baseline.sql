-- Recreate the application schema from a clean Supabase database.
-- Reset inherited per-schema defaults while creating objects; the dump restores
-- the original defaults after applying the precise object grants below.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."append_playlist_item"("p_playlist_id" "uuid", "p_media_type" "text", "p_tmdb_id" bigint, "p_media_title" "text", "p_poster_path" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.playlists where id = p_playlist_id and user_id = auth.uid() for update;
  if not found then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.playlist_items(playlist_id, media_type, tmdb_id, media_title, poster_path, position)
  select p_playlist_id, p_media_type, p_tmdb_id, p_media_title, p_poster_path, coalesce(max(position) + 1, 0)
  from public.playlist_items where playlist_id = p_playlist_id
  on conflict (playlist_id, media_type, tmdb_id) do nothing;
end $$;


ALTER FUNCTION "public"."append_playlist_item"("p_playlist_id" "uuid", "p_media_type" "text", "p_tmdb_id" bigint, "p_media_title" "text", "p_poster_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_profile_for_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare candidate text; display_label text;
begin
  display_label := nullif(trim(new.raw_user_meta_data->>'display_name'), '');
  if display_label is null or position('@' in display_label) > 0 then display_label := 'Filmgram user'; end if;
  loop
    candidate := 'user_' || replace(gen_random_uuid()::text, '-', '');
    begin
      insert into public.profiles(id, handle, display_name)
      values(new.id, left(candidate, 30), left(display_label, 80));
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return new;
end $$;


ALTER FUNCTION "public"."create_profile_for_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_review_comment"("p_review_id" "uuid", "p_parent_id" "uuid", "p_body" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
 if p_parent_id is not null then
  raise exception 'Nested comments are read-only' using errcode = '22023';
 end if;
 return public.create_review_comment_with_mention(p_review_id,null,p_body);
end $$;


ALTER FUNCTION "public"."create_review_comment"("p_review_id" "uuid", "p_parent_id" "uuid", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_review_comment_with_mention"("p_review_id" "uuid", "p_target_comment_id" "uuid", "p_body" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select public.create_review_comment_with_mention(p_review_id, p_target_comment_id, p_body, null)
$$;


ALTER FUNCTION "public"."create_review_comment_with_mention"("p_review_id" "uuid", "p_target_comment_id" "uuid", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_review_comment_with_mention"("p_review_id" "uuid", "p_target_comment_id" "uuid", "p_body" "text", "p_attempt_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."create_review_comment_with_mention"("p_review_id" "uuid", "p_target_comment_id" "uuid", "p_body" "text", "p_attempt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_review_comment"("p_comment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 update public.review_comments set body = null, deleted_at = clock_timestamp(), updated_at = clock_timestamp() where id = p_comment_id and user_id = auth.uid() and deleted_at is null;
 if not found then raise exception 'Comment not found' using errcode = '42501'; end if;
end $$;


ALTER FUNCTION "public"."delete_review_comment"("p_comment_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "handle" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_display_name_check" CHECK ((("char_length"("display_name") >= 1) AND ("char_length"("display_name") <= 80))),
    CONSTRAINT "profiles_handle_check" CHECK (("handle" ~ '^[a-z0-9_]{3,30}$'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "user_id" "uuid",
    "body" "text",
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "mentioned_profile_id" "uuid",
    CONSTRAINT "review_comment_body" CHECK (((("deleted_at" IS NULL) AND ("body" IS NOT NULL) AND (("char_length"("btrim"("body")) >= 1) AND ("char_length"("btrim"("body")) <= 2000))) OR (("deleted_at" IS NOT NULL) AND ("body" IS NULL))))
);


ALTER TABLE "public"."review_comments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."flat_review_comments" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."review_id",
    "c"."parent_id",
    "c"."user_id",
    "c"."body",
    "c"."created_at",
    "c"."updated_at",
    "c"."deleted_at",
    "author"."display_name",
    "author"."handle",
    "author"."avatar_url",
    COALESCE("mentioned"."handle", "target_author"."handle") AS "reply_to_handle"
   FROM (((("public"."review_comments" "c"
     LEFT JOIN "public"."profiles" "author" ON ((("author"."id" = "c"."user_id") AND ("c"."deleted_at" IS NULL))))
     LEFT JOIN "public"."review_comments" "target" ON ((("target"."id" = "c"."parent_id") AND ("target"."review_id" = "c"."review_id") AND ("target"."deleted_at" IS NULL))))
     LEFT JOIN "public"."profiles" "target_author" ON (("target_author"."id" = "target"."user_id")))
     LEFT JOIN "public"."profiles" "mentioned" ON (("mentioned"."id" = "c"."mentioned_profile_id")));


ALTER VIEW "public"."flat_review_comments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."flat_review_comments_page"("p_review_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) RETURNS SETOF "public"."flat_review_comments"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
 select c.* from public.flat_review_comments c
 where c.review_id = p_review_id
 and ((p_after_created_at is null and p_after_id is null)
      or (c.created_at,c.id) > (p_after_created_at,p_after_id))
 order by c.created_at,c.id limit least(greatest(coalesce(p_limit,21),1),101)
$$;


ALTER FUNCTION "public"."flat_review_comments_page"("p_review_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."following_feed"("p_before_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_before_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "media_type" "text", "tmdb_id" bigint, "rating" integer, "body" "text", "body_document" "jsonb", "youtube_video_id" "text", "created_at" timestamp with time zone, "display_name" "text", "handle" "text", "avatar_url" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."following_feed"("p_before_created_at" timestamp with time zone, "p_before_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."most_liked_titles"("p_limit" integer DEFAULT 12) RETURNS TABLE("media_type" "text", "tmdb_id" bigint, "like_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select l.media_type, l.tmdb_id, count(*) as like_count from public.title_likes l
 group by l.media_type, l.tmdb_id order by like_count desc, l.media_type, l.tmdb_id
 limit greatest(1, least(coalesce(p_limit, 12), 50))
$$;


ALTER FUNCTION "public"."most_liked_titles"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."most_liked_titles"("p_limit" integer, "p_media_type" "text") RETURNS TABLE("media_type" "text", "tmdb_id" bigint, "like_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select l.media_type, l.tmdb_id, count(*) as like_count
  from public.title_likes l
  where l.media_type = p_media_type
  group by l.media_type, l.tmdb_id
  order by like_count desc, l.tmdb_id
  limit greatest(1, least(coalesce(p_limit, 12), 50))
$$;


ALTER FUNCTION "public"."most_liked_titles"("p_limit" integer, "p_media_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."movie_review_page"("p_tmdb_id" bigint, "p_after_followed" boolean DEFAULT NULL::boolean, "p_after_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_after_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 21) RETURNS TABLE("id" "uuid", "rating" integer, "body" "text", "body_document" "jsonb", "youtube_video_id" "text", "user_id" "uuid", "created_at" timestamp with time zone, "display_name" "text", "handle" "text", "avatar_url" "text", "followed" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select * from public.title_review_page(
    'movie', p_tmdb_id, p_after_followed, p_after_created_at, p_after_id, p_limit
  )
$$;


ALTER FUNCTION "public"."movie_review_page"("p_tmdb_id" bigint, "p_after_followed" boolean, "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."person_rating_stats"("p_person_id" bigint) RETURNS TABLE("average_rating" numeric, "review_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select avg(r.rating), count(*) from public.person_reviews r where r.person_tmdb_id = p_person_id
$$;


ALTER FUNCTION "public"."person_rating_stats"("p_person_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_stats"("p_profile_id" "uuid") RETURNS TABLE("follower_count" bigint, "following_count" bigint, "review_count" bigint, "like_count" bigint, "movie_count" bigint, "series_count" bigint, "genre_counts" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select (select count(*) from public.follows where following_id = p_profile_id),
        (select count(*) from public.follows where follower_id = p_profile_id),
        (select count(*) from public.reviews where user_id = p_profile_id),
        (select count(*) from public.title_likes where user_id = p_profile_id),
        (select count(*) from public.watched where user_id = p_profile_id and media_type = 'movie'),
        (select count(*) from public.watched where user_id = p_profile_id and media_type = 'tv'),
        (select coalesce(jsonb_object_agg(genre_id::text, total), '{}'::jsonb) from
          (select genre_id, count(*) as total from public.watched w cross join lateral (select distinct unnest(w.genre_ids) as genre_id) g where w.user_id = p_profile_id group by genre_id) genres)
$$;


ALTER FUNCTION "public"."profile_stats"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_viewing_stats"("p_period" "text" DEFAULT 'all'::"text") RETURNS TABLE("movie_count" bigint, "series_count" bigint, "genre_counts" "jsonb")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."profile_viewing_stats"("p_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_viewing_titles"("p_period" "text" DEFAULT 'all'::"text", "p_ranking" boolean DEFAULT false, "p_limit" integer DEFAULT 12, "p_offset" integer DEFAULT 0, "p_type" "text" DEFAULT 'all'::"text") RETURNS TABLE("media_type" "text", "tmdb_id" bigint, "media_title" "text", "poster_path" "text", "genre_ids" integer[], "last_watched_at" timestamp with time zone, "watch_count" bigint, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."profile_viewing_titles"("p_period" "text", "p_ranking" boolean, "p_limit" integer, "p_offset" integer, "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_rewatch"("p_media_type" "text", "p_tmdb_id" bigint, "p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."record_rewatch"("p_media_type" "text", "p_tmdb_id" bigint, "p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_playlist_item"("p_playlist_id" "uuid", "p_item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.playlists where id = p_playlist_id and user_id = auth.uid() for update;
  if not found then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.playlist_items where playlist_id = p_playlist_id and id = p_item_id;
  set constraints public.playlist_items_position_unique deferred;
  with ordered as (select id, row_number() over (order by position, id) - 1 as new_position from public.playlist_items where playlist_id = p_playlist_id)
  update public.playlist_items i set position = ordered.new_position::integer from ordered where i.id = ordered.id;
end $$;


ALTER FUNCTION "public"."remove_playlist_item"("p_playlist_id" "uuid", "p_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_playlist_items"("p_playlist_id" "uuid", "p_item_ids" "uuid"[], "p_expected_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare current_ids uuid[];
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.playlists where id = p_playlist_id and user_id = auth.uid() for update;
  if not found then raise exception 'Not authorized' using errcode = '42501'; end if;
  select coalesce(array_agg(id order by position, id), '{}'::uuid[]) into current_ids from public.playlist_items where playlist_id = p_playlist_id;
  if p_expected_ids is distinct from current_ids then raise exception 'Playlist order changed; refresh and try again' using errcode = 'PT409'; end if;
  if p_item_ids is null or cardinality(p_item_ids) <> cardinality(current_ids)
     or (select count(distinct id) from unnest(p_item_ids) as ids(id)) <> cardinality(current_ids)
     or exists (select 1 from unnest(p_item_ids) as ids(id) where id is null or not (id = any(current_ids))) then
    raise exception 'Item IDs must contain every playlist item exactly once' using errcode = '22023';
  end if;
  set constraints public.playlist_items_position_unique deferred;
  update public.playlist_items i set position = (ordered.ordinality - 1)::integer
  from unnest(p_item_ids) with ordinality as ordered(id, ordinality) where i.id = ordered.id and i.playlist_id = p_playlist_id;
end $$;


ALTER FUNCTION "public"."reorder_playlist_items"("p_playlist_id" "uuid", "p_item_ids" "uuid"[], "p_expected_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_comment_like_summaries"("p_comment_ids" "uuid"[]) RETURNS TABLE("comment_id" "uuid", "like_count" bigint, "liked" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select c.id, count(l.user_id), coalesce(bool_or(l.user_id = auth.uid()), false)
  from public.review_comments c
  left join public.review_comment_likes l on l.comment_id = c.id
  where c.id = any(p_comment_ids) and c.deleted_at is null
  group by c.id
$$;


ALTER FUNCTION "public"."review_comment_like_summaries"("p_comment_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_comments_page"("p_review_id" "uuid", "p_parent_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) RETURNS TABLE("id" "uuid", "review_id" "uuid", "parent_id" "uuid", "user_id" "uuid", "body" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "deleted_at" timestamp with time zone, "display_name" "text", "handle" "text", "avatar_url" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
 select c.id,c.review_id,c.parent_id,c.user_id,c.body,c.created_at,c.updated_at,c.deleted_at,p.display_name,p.handle,p.avatar_url
 from public.review_comments c left join public.profiles p on p.id = c.user_id
 where c.review_id = p_review_id and c.parent_id is not distinct from p_parent_id
 and ((p_after_created_at is null and p_after_id is null) or (c.created_at,c.id) > (p_after_created_at,p_after_id))
 order by c.created_at,c.id limit least(greatest(coalesce(p_limit, 21),1),101)
$$;


ALTER FUNCTION "public"."review_comments_page"("p_review_id" "uuid", "p_parent_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_like_summaries"("p_review_ids" "uuid"[]) RETURNS TABLE("review_id" "uuid", "like_count" bigint, "liked" boolean, "comment_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select r.id, count(l.user_id), coalesce(bool_or(l.user_id = auth.uid()), false), (select count(*) from public.review_comments c where c.review_id = r.id and c.deleted_at is null)
 from public.reviews r left join public.review_likes l on l.review_id = r.id
 where r.id = any(p_review_ids) group by r.id
$$;


ALTER FUNCTION "public"."review_like_summaries"("p_review_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_person_review"("p_person_id" bigint, "p_rating" integer, "p_body" "text", "p_works" "jsonb", "p_expected_updated_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
declare
  v_user uuid := auth.uid();
  v_review uuid;
  v_work jsonb;
  v_id_text text;
  v_seen text[] := '{}';
  v_key text;
  v_pos integer := 0;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_person_id is null or p_person_id not between 1 and 9007199254740991 or
     p_rating is null or p_rating not between 0 and 10 or
     (p_body is not null and char_length(p_body) > 10000) then
    raise exception 'Invalid review' using errcode = '22023';
  end if;
  if p_works is null or jsonb_typeof(p_works) <> 'array' then
    raise exception 'Invalid works' using errcode = '22023';
  end if;
  if jsonb_array_length(p_works) > 10 then
    raise exception 'Too many works' using errcode = '22023';
  end if;
  for v_work in select value from jsonb_array_elements(p_works) loop
    if jsonb_typeof(v_work) <> 'object' or jsonb_typeof(v_work->'tmdb_id') <> 'number'
       or coalesce(v_work->>'media_type','') not in ('movie','tv') then
      raise exception 'Invalid work' using errcode = '22023';
    end if;
    v_id_text := v_work->>'tmdb_id';
    if v_id_text is null or v_id_text !~ '^[1-9][0-9]{0,15}$' or v_id_text::numeric > 9007199254740991 then
      raise exception 'Invalid work ID' using errcode = '22023';
    end if;
    v_key := (v_work->>'media_type') || ':' || v_id_text;
    if v_key = any(v_seen) then raise exception 'Duplicate work' using errcode = '22023'; end if;
    v_seen := array_append(v_seen, v_key);
  end loop;
  if p_expected_updated_at is null then
    insert into public.person_reviews(user_id, person_tmdb_id, rating, body)
    values (v_user, p_person_id, p_rating, nullif(btrim(p_body), ''))
    on conflict (user_id, person_tmdb_id) do nothing returning id into v_review;
  else
    update public.person_reviews set rating = p_rating, body = nullif(btrim(p_body), ''), updated_at = clock_timestamp()
    where user_id = v_user and person_tmdb_id = p_person_id and updated_at = p_expected_updated_at
    returning id into v_review;
  end if;
  if v_review is null then raise exception 'Review changed' using errcode = '40001'; end if;
  delete from public.person_review_works where review_id = v_review;
  for v_work in select value from jsonb_array_elements(p_works) loop
    v_pos := v_pos + 1;
    insert into public.person_review_works(review_id, media_type, tmdb_id, position)
    values (v_review, v_work->>'media_type', (v_work->>'tmdb_id')::bigint, v_pos);
  end loop;
  return v_review;
end $_$;


ALTER FUNCTION "public"."save_person_review"("p_person_id" bigint, "p_rating" integer, "p_body" "text", "p_works" "jsonb", "p_expected_updated_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_review_comment_like"("p_comment_id" "uuid", "p_liked" boolean) RETURNS TABLE("comment_id" "uuid", "like_count" bigint, "liked" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_liked is null then raise exception 'Invalid like' using errcode = '22023'; end if;
  perform 1 from public.review_comments c
    where c.id = p_comment_id and c.deleted_at is null for share;
  if not found then raise exception 'Comment not found' using errcode = '22023'; end if;

  if p_liked then
    insert into public.review_comment_likes(comment_id,user_id)
      values (p_comment_id,viewer) on conflict on constraint review_comment_likes_pkey do nothing;
  else
    delete from public.review_comment_likes l where l.comment_id = p_comment_id and l.user_id = viewer;
  end if;
  return query select * from public.review_comment_like_summaries(array[p_comment_id]);
end $$;


ALTER FUNCTION "public"."set_review_comment_like"("p_comment_id" "uuid", "p_liked" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_review_like"("p_review_id" "uuid", "p_liked" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if p_review_id is null or p_liked is null then raise exception 'Invalid like' using errcode = '22023'; end if;
 if p_liked then
  insert into public.review_likes(review_id,user_id) values (p_review_id,auth.uid()) on conflict do nothing;
 else
  delete from public.review_likes where review_id = p_review_id and user_id = auth.uid();
 end if;
end $$;


ALTER FUNCTION "public"."set_review_like"("p_review_id" "uuid", "p_liked" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_initial_viewing_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."sync_initial_viewing_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."title_like_count"("p_media_type" "text", "p_tmdb_id" bigint) RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select count(*) from public.title_likes where media_type = p_media_type and tmdb_id = p_tmdb_id
$$;


ALTER FUNCTION "public"."title_like_count"("p_media_type" "text", "p_tmdb_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."title_review_page"("p_media_type" "text", "p_tmdb_id" bigint, "p_after_followed" boolean DEFAULT NULL::boolean, "p_after_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_after_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 21) RETURNS TABLE("id" "uuid", "rating" integer, "body" "text", "body_document" "jsonb", "youtube_video_id" "text", "user_id" "uuid", "created_at" timestamp with time zone, "display_name" "text", "handle" "text", "avatar_url" "text", "followed" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select r.id, r.rating, r.body, r.body_document, r.youtube_video_id, r.user_id, r.created_at, p.display_name, p.handle, p.avatar_url, (f.following_id is not null) as followed
  from public.reviews r
  left join public.profiles p on p.id = r.user_id
  left join public.follows f on f.following_id = r.user_id and f.follower_id = (select auth.uid())
  where r.media_type = p_media_type and r.tmdb_id = p_tmdb_id
    and (p_after_id is null or ((f.following_id is not null), r.created_at, r.id) < (p_after_followed, p_after_created_at, p_after_id))
  order by followed desc, r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 21), 1), 21)
$$;


ALTER FUNCTION "public"."title_review_page"("p_media_type" "text", "p_tmdb_id" bigint, "p_after_followed" boolean, "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."title_review_stats"("p_media_type" "text", "p_tmdb_id" bigint) RETURNS TABLE("review_count" bigint, "average_rating" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select count(*), coalesce(avg(r.rating), 0)
  from public.reviews r
  where r.media_type = p_media_type and r.tmdb_id = p_tmdb_id;
$$;


ALTER FUNCTION "public"."title_review_stats"("p_media_type" "text", "p_tmdb_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."title_reviews_followed_first"("p_media_type" "text", "p_tmdb_id" bigint, "p_highlighted_review_id" "uuid", "p_limit" integer) RETURNS TABLE("id" "uuid", "rating" integer, "body" "text", "body_document" "jsonb", "youtube_video_id" "text", "user_id" "uuid", "created_at" timestamp with time zone, "display_name" "text", "handle" "text", "avatar_url" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."title_reviews_followed_first"("p_media_type" "text", "p_tmdb_id" bigint, "p_highlighted_review_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tombstone_deleted_profile_comments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
 update public.review_comments set body = null, deleted_at = coalesce(deleted_at, clock_timestamp()), updated_at = clock_timestamp()
 where user_id = old.id;
 return old;
end $$;


ALTER FUNCTION "public"."tombstone_deleted_profile_comments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_person_review"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
    new.updated_at := new.created_at;
  else
    new.created_at := old.created_at;
    new.updated_at := clock_timestamp();
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."touch_person_review"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ begin new.updated_at = now(); return new; end $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_review_comment"("p_comment_id" "uuid", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'Invalid comment' using errcode = '22023'; end if;
 update public.review_comments set body = btrim(p_body), updated_at = clock_timestamp() where id = p_comment_id and user_id = auth.uid() and deleted_at is null;
 if not found then raise exception 'Comment not found' using errcode = '42501'; end if;
end $$;


ALTER FUNCTION "public"."update_review_comment"("p_comment_id" "uuid", "p_body" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "private"."review_comment_attempts" (
    "author_id" "uuid" NOT NULL,
    "attempt_id" "uuid" NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "target_comment_id" "uuid"
);


ALTER TABLE "private"."review_comment_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "user_id" "uuid" NOT NULL,
    "media_type" "text" NOT NULL,
    "tmdb_id" bigint NOT NULL,
    "media_title" "text" NOT NULL,
    "poster_path" "text",
    "genre_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "favorites_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "favorites_tmdb_id_check" CHECK (("tmdb_id" > 0))
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "follows_check" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_review_works" (
    "review_id" "uuid" NOT NULL,
    "media_type" "text" NOT NULL,
    "tmdb_id" bigint NOT NULL,
    "position" integer NOT NULL,
    CONSTRAINT "person_review_works_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "person_review_works_position_check" CHECK ((("position" >= 1) AND ("position" <= 10))),
    CONSTRAINT "person_review_works_tmdb_id_check" CHECK ((("tmdb_id" >= 1) AND ("tmdb_id" <= '9007199254740991'::bigint)))
);


ALTER TABLE "public"."person_review_works" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "person_tmdb_id" bigint NOT NULL,
    "rating" integer NOT NULL,
    "body" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "person_reviews_body_check" CHECK ((("body" IS NULL) OR ("char_length"("body") <= 10000))),
    CONSTRAINT "person_reviews_person_tmdb_id_check" CHECK ((("person_tmdb_id" >= 1) AND ("person_tmdb_id" <= '9007199254740991'::bigint))),
    CONSTRAINT "person_reviews_rating_check" CHECK ((("rating" >= 0) AND ("rating" <= 10)))
);


ALTER TABLE "public"."person_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "playlist_id" "uuid" NOT NULL,
    "media_type" "text" NOT NULL,
    "tmdb_id" bigint NOT NULL,
    "position" integer NOT NULL,
    "media_title" "text" NOT NULL,
    "poster_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "playlist_items_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "playlist_items_position_check" CHECK (("position" >= 0)),
    CONSTRAINT "playlist_items_tmdb_id_check" CHECK (("tmdb_id" > 0))
);


ALTER TABLE "public"."playlist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "playlists_description_check" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 2000))),
    CONSTRAINT "playlists_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 100)))
);


ALTER TABLE "public"."playlists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_comment_likes" (
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."review_comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_likes" (
    "review_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."review_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_type" "text" NOT NULL,
    "tmdb_id" bigint NOT NULL,
    "rating" integer NOT NULL,
    "body" "text",
    "youtube_video_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "body_document" "jsonb",
    CONSTRAINT "reviews_body_check" CHECK ((("body" IS NULL) OR ("char_length"("body") <= 10000))),
    CONSTRAINT "reviews_body_document_shape" CHECK ((("body_document" IS NULL) OR (("jsonb_typeof"("body_document") = 'object'::"text") AND COALESCE(("jsonb_typeof"(("body_document" -> 'blocks'::"text")) = 'array'::"text"), false) AND ("octet_length"(("body_document")::"text") <= 100000)))),
    CONSTRAINT "reviews_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 0) AND ("rating" <= 10))),
    CONSTRAINT "reviews_tmdb_id_check" CHECK (("tmdb_id" > 0)),
    CONSTRAINT "reviews_youtube_video_id_check" CHECK ((("youtube_video_id" IS NULL) OR ("youtube_video_id" ~ '^[A-Za-z0-9_-]{11}$'::"text")))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."title_likes" (
    "user_id" "uuid" NOT NULL,
    "media_type" "text" NOT NULL,
    "tmdb_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "title_likes_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "title_likes_tmdb_id_check" CHECK (("tmdb_id" > 0))
);


ALTER TABLE "public"."title_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."viewing_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_type" "text" NOT NULL,
    "tmdb_id" bigint NOT NULL,
    "media_title" "text" NOT NULL,
    "poster_path" "text",
    "genre_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "watched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "text" NOT NULL,
    "request_id" "uuid",
    CONSTRAINT "viewing_events_check" CHECK ((("kind" = 'rewatch'::"text") = ("request_id" IS NOT NULL))),
    CONSTRAINT "viewing_events_kind_check" CHECK (("kind" = ANY (ARRAY['initial'::"text", 'rewatch'::"text"]))),
    CONSTRAINT "viewing_events_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "viewing_events_tmdb_id_check" CHECK (("tmdb_id" > 0))
);


ALTER TABLE "public"."viewing_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."watched" (
    "user_id" "uuid" NOT NULL,
    "media_type" "text" NOT NULL,
    "tmdb_id" bigint NOT NULL,
    "media_title" "text" NOT NULL,
    "poster_path" "text",
    "genre_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "watched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "watched_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "watched_tmdb_id_check" CHECK (("tmdb_id" > 0))
);


ALTER TABLE "public"."watched" OWNER TO "postgres";


ALTER TABLE ONLY "private"."review_comment_attempts"
    ADD CONSTRAINT "review_comment_attempts_comment_id_key" UNIQUE ("comment_id");



ALTER TABLE ONLY "private"."review_comment_attempts"
    ADD CONSTRAINT "review_comment_attempts_pkey" PRIMARY KEY ("author_id", "attempt_id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id", "media_type", "tmdb_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "following_id");



ALTER TABLE ONLY "public"."person_review_works"
    ADD CONSTRAINT "person_review_works_pkey" PRIMARY KEY ("review_id", "media_type", "tmdb_id");



ALTER TABLE ONLY "public"."person_review_works"
    ADD CONSTRAINT "person_review_works_review_id_position_key" UNIQUE ("review_id", "position");



ALTER TABLE ONLY "public"."person_reviews"
    ADD CONSTRAINT "person_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_reviews"
    ADD CONSTRAINT "person_reviews_user_id_person_tmdb_id_key" UNIQUE ("user_id", "person_tmdb_id");



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_playlist_id_media_type_tmdb_id_key" UNIQUE ("playlist_id", "media_type", "tmdb_id");



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_position_unique" UNIQUE ("playlist_id", "position") DEFERRABLE;



ALTER TABLE ONLY "public"."playlists"
    ADD CONSTRAINT "playlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_comment_likes"
    ADD CONSTRAINT "review_comment_likes_pkey" PRIMARY KEY ("comment_id", "user_id");



ALTER TABLE ONLY "public"."review_comments"
    ADD CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_likes"
    ADD CONSTRAINT "review_likes_pkey" PRIMARY KEY ("review_id", "user_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_media_type_tmdb_id_key" UNIQUE ("user_id", "media_type", "tmdb_id");



ALTER TABLE ONLY "public"."title_likes"
    ADD CONSTRAINT "title_likes_pkey" PRIMARY KEY ("user_id", "media_type", "tmdb_id");



ALTER TABLE ONLY "public"."viewing_events"
    ADD CONSTRAINT "viewing_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."viewing_events"
    ADD CONSTRAINT "viewing_events_user_id_request_id_key" UNIQUE ("user_id", "request_id");



ALTER TABLE ONLY "public"."watched"
    ADD CONSTRAINT "watched_pkey" PRIMARY KEY ("user_id", "media_type", "tmdb_id");



CREATE INDEX "follows_following_idx" ON "public"."follows" USING "btree" ("following_id");



CREATE INDEX "person_reviews_person_order_idx" ON "public"."person_reviews" USING "btree" ("person_tmdb_id", "updated_at" DESC, "id" DESC);



CREATE INDEX "playlists_user_idx" ON "public"."playlists" USING "btree" ("user_id");



CREATE INDEX "review_comment_likes_user_idx" ON "public"."review_comment_likes" USING "btree" ("user_id");



CREATE INDEX "review_comments_flat_page_idx" ON "public"."review_comments" USING "btree" ("review_id", "created_at", "id");



CREATE INDEX "review_comments_mentioned_profile_idx" ON "public"."review_comments" USING "btree" ("mentioned_profile_id") WHERE ("mentioned_profile_id" IS NOT NULL);



CREATE INDEX "review_comments_page_idx" ON "public"."review_comments" USING "btree" ("review_id", "parent_id", "created_at", "id");



CREATE INDEX "reviews_feed_idx" ON "public"."reviews" USING "btree" ("user_id", "created_at" DESC, "id" DESC);



CREATE INDEX "reviews_title_idx" ON "public"."reviews" USING "btree" ("media_type", "tmdb_id", "created_at" DESC);



CREATE INDEX "reviews_title_page_idx" ON "public"."reviews" USING "btree" ("media_type", "tmdb_id", "created_at" DESC, "id" DESC);



CREATE INDEX "title_likes_title_idx" ON "public"."title_likes" USING "btree" ("media_type", "tmdb_id");



CREATE UNIQUE INDEX "viewing_events_initial_idx" ON "public"."viewing_events" USING "btree" ("user_id", "media_type", "tmdb_id") WHERE ("kind" = 'initial'::"text");



CREATE INDEX "viewing_events_user_date_idx" ON "public"."viewing_events" USING "btree" ("user_id", "watched_at" DESC, "id" DESC);



CREATE OR REPLACE TRIGGER "person_reviews_touch" BEFORE INSERT OR UPDATE ON "public"."person_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."touch_person_review"();



CREATE OR REPLACE TRIGGER "playlists_touch" BEFORE UPDATE ON "public"."playlists" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "reviews_touch" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "tombstone_deleted_profile_comments" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tombstone_deleted_profile_comments"();



CREATE OR REPLACE TRIGGER "watched_viewing_event" AFTER INSERT OR DELETE ON "public"."watched" FOR EACH ROW EXECUTE FUNCTION "public"."sync_initial_viewing_event"();



ALTER TABLE ONLY "private"."review_comment_attempts"
    ADD CONSTRAINT "review_comment_attempts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "private"."review_comment_attempts"
    ADD CONSTRAINT "review_comment_attempts_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."review_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_review_works"
    ADD CONSTRAINT "person_review_works_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."person_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_reviews"
    ADD CONSTRAINT "person_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlists"
    ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_comment_likes"
    ADD CONSTRAINT "review_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."review_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_comment_likes"
    ADD CONSTRAINT "review_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_comments"
    ADD CONSTRAINT "review_comments_mentioned_profile_id_fkey" FOREIGN KEY ("mentioned_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."review_comments"
    ADD CONSTRAINT "review_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."review_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_comments"
    ADD CONSTRAINT "review_comments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_comments"
    ADD CONSTRAINT "review_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."review_likes"
    ADD CONSTRAINT "review_likes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_likes"
    ADD CONSTRAINT "review_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."title_likes"
    ADD CONSTRAINT "title_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."viewing_events"
    ADD CONSTRAINT "viewing_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."watched"
    ADD CONSTRAINT "watched_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "private"."review_comment_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "favorites_own" ON "public"."favorites" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "follows_delete" ON "public"."follows" FOR DELETE TO "authenticated" USING (("follower_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "follows_insert" ON "public"."follows" FOR INSERT TO "authenticated" WITH CHECK (("follower_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "follows_read" ON "public"."follows" FOR SELECT USING (true);



CREATE POLICY "likes_own" ON "public"."title_likes" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."person_review_works" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_review_works_delete" ON "public"."person_review_works" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."person_reviews" "r"
  WHERE (("r"."id" = "person_review_works"."review_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "person_review_works_insert" ON "public"."person_review_works" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."person_reviews" "r"
  WHERE (("r"."id" = "person_review_works"."review_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "person_review_works_read" ON "public"."person_review_works" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "person_review_works_update" ON "public"."person_review_works" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."person_reviews" "r"
  WHERE (("r"."id" = "person_review_works"."review_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."person_reviews" "r"
  WHERE (("r"."id" = "person_review_works"."review_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."person_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_reviews_delete" ON "public"."person_reviews" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "person_reviews_insert" ON "public"."person_reviews" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "person_reviews_read" ON "public"."person_reviews" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "person_reviews_update" ON "public"."person_reviews" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."playlist_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "playlist_items_delete" ON "public"."playlist_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."playlists" "p"
  WHERE (("p"."id" = "playlist_items"."playlist_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "playlist_items_insert" ON "public"."playlist_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."playlists" "p"
  WHERE (("p"."id" = "playlist_items"."playlist_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "playlist_items_read" ON "public"."playlist_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."playlists" "p"
  WHERE (("p"."id" = "playlist_items"."playlist_id") AND ("p"."is_public" OR ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "playlist_items_update" ON "public"."playlist_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."playlists" "p"
  WHERE (("p"."id" = "playlist_items"."playlist_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."playlists" "p"
  WHERE (("p"."id" = "playlist_items"."playlist_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."playlists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "playlists_delete" ON "public"."playlists" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "playlists_insert" ON "public"."playlists" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "playlists_read" ON "public"."playlists" FOR SELECT USING (("is_public" OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "playlists_update" ON "public"."playlists" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_read" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."review_comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_comments_read" ON "public"."review_comments" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."review_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_likes_own" ON "public"."review_likes" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_delete" ON "public"."reviews" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "reviews_insert" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "reviews_read" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "reviews_update" ON "public"."reviews" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."title_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."viewing_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "viewing_events_read_own" ON "public"."viewing_events" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."watched" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "watched_own" ON "public"."watched" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."append_playlist_item"("p_playlist_id" "uuid", "p_media_type" "text", "p_tmdb_id" bigint, "p_media_title" "text", "p_poster_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."append_playlist_item"("p_playlist_id" "uuid", "p_media_type" "text", "p_tmdb_id" bigint, "p_media_title" "text", "p_poster_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_playlist_item"("p_playlist_id" "uuid", "p_media_type" "text", "p_tmdb_id" bigint, "p_media_title" "text", "p_poster_path" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_profile_for_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_profile_for_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_review_comment"("p_review_id" "uuid", "p_parent_id" "uuid", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_review_comment"("p_review_id" "uuid", "p_parent_id" "uuid", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_review_comment"("p_review_id" "uuid", "p_parent_id" "uuid", "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_review_comment_with_mention"("p_review_id" "uuid", "p_target_comment_id" "uuid", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_review_comment_with_mention"("p_review_id" "uuid", "p_target_comment_id" "uuid", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_review_comment_with_mention"("p_review_id" "uuid", "p_target_comment_id" "uuid", "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_review_comment_with_mention"("p_review_id" "uuid", "p_target_comment_id" "uuid", "p_body" "text", "p_attempt_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_review_comment_with_mention"("p_review_id" "uuid", "p_target_comment_id" "uuid", "p_body" "text", "p_attempt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_review_comment_with_mention"("p_review_id" "uuid", "p_target_comment_id" "uuid", "p_body" "text", "p_attempt_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_review_comment"("p_comment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_review_comment"("p_comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_review_comment"("p_comment_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."review_comments" TO "service_role";
GRANT SELECT ON TABLE "public"."review_comments" TO "anon";
GRANT SELECT ON TABLE "public"."review_comments" TO "authenticated";



GRANT ALL ON TABLE "public"."flat_review_comments" TO "service_role";
GRANT SELECT ON TABLE "public"."flat_review_comments" TO "anon";
GRANT SELECT ON TABLE "public"."flat_review_comments" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."flat_review_comments_page"("p_review_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."flat_review_comments_page"("p_review_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."flat_review_comments_page"("p_review_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."flat_review_comments_page"("p_review_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."following_feed"("p_before_created_at" timestamp with time zone, "p_before_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."following_feed"("p_before_created_at" timestamp with time zone, "p_before_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."following_feed"("p_before_created_at" timestamp with time zone, "p_before_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."most_liked_titles"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."most_liked_titles"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."most_liked_titles"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."most_liked_titles"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."most_liked_titles"("p_limit" integer, "p_media_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."most_liked_titles"("p_limit" integer, "p_media_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."most_liked_titles"("p_limit" integer, "p_media_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."most_liked_titles"("p_limit" integer, "p_media_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."movie_review_page"("p_tmdb_id" bigint, "p_after_followed" boolean, "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."movie_review_page"("p_tmdb_id" bigint, "p_after_followed" boolean, "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."movie_review_page"("p_tmdb_id" bigint, "p_after_followed" boolean, "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."movie_review_page"("p_tmdb_id" bigint, "p_after_followed" boolean, "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."person_rating_stats"("p_person_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."person_rating_stats"("p_person_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."person_rating_stats"("p_person_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."person_rating_stats"("p_person_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."profile_stats"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."profile_stats"("p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."profile_stats"("p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_stats"("p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."profile_viewing_stats"("p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."profile_viewing_stats"("p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_viewing_stats"("p_period" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."profile_viewing_titles"("p_period" "text", "p_ranking" boolean, "p_limit" integer, "p_offset" integer, "p_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."profile_viewing_titles"("p_period" "text", "p_ranking" boolean, "p_limit" integer, "p_offset" integer, "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_viewing_titles"("p_period" "text", "p_ranking" boolean, "p_limit" integer, "p_offset" integer, "p_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_rewatch"("p_media_type" "text", "p_tmdb_id" bigint, "p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_rewatch"("p_media_type" "text", "p_tmdb_id" bigint, "p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_rewatch"("p_media_type" "text", "p_tmdb_id" bigint, "p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_playlist_item"("p_playlist_id" "uuid", "p_item_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_playlist_item"("p_playlist_id" "uuid", "p_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_playlist_item"("p_playlist_id" "uuid", "p_item_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reorder_playlist_items"("p_playlist_id" "uuid", "p_item_ids" "uuid"[], "p_expected_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_playlist_items"("p_playlist_id" "uuid", "p_item_ids" "uuid"[], "p_expected_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_playlist_items"("p_playlist_id" "uuid", "p_item_ids" "uuid"[], "p_expected_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."review_comment_like_summaries"("p_comment_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_comment_like_summaries"("p_comment_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."review_comment_like_summaries"("p_comment_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."review_comment_like_summaries"("p_comment_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."review_comments_page"("p_review_id" "uuid", "p_parent_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_comments_page"("p_review_id" "uuid", "p_parent_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."review_comments_page"("p_review_id" "uuid", "p_parent_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_comments_page"("p_review_id" "uuid", "p_parent_id" "uuid", "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."review_like_summaries"("p_review_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_like_summaries"("p_review_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."review_like_summaries"("p_review_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_like_summaries"("p_review_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_person_review"("p_person_id" bigint, "p_rating" integer, "p_body" "text", "p_works" "jsonb", "p_expected_updated_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_person_review"("p_person_id" bigint, "p_rating" integer, "p_body" "text", "p_works" "jsonb", "p_expected_updated_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_person_review"("p_person_id" bigint, "p_rating" integer, "p_body" "text", "p_works" "jsonb", "p_expected_updated_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_review_comment_like"("p_comment_id" "uuid", "p_liked" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_review_comment_like"("p_comment_id" "uuid", "p_liked" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."set_review_comment_like"("p_comment_id" "uuid", "p_liked" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_review_like"("p_review_id" "uuid", "p_liked" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_review_like"("p_review_id" "uuid", "p_liked" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_review_like"("p_review_id" "uuid", "p_liked" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_initial_viewing_event"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_initial_viewing_event"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."title_like_count"("p_media_type" "text", "p_tmdb_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."title_like_count"("p_media_type" "text", "p_tmdb_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."title_like_count"("p_media_type" "text", "p_tmdb_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."title_like_count"("p_media_type" "text", "p_tmdb_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."title_review_page"("p_media_type" "text", "p_tmdb_id" bigint, "p_after_followed" boolean, "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."title_review_page"("p_media_type" "text", "p_tmdb_id" bigint, "p_after_followed" boolean, "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."title_review_page"("p_media_type" "text", "p_tmdb_id" bigint, "p_after_followed" boolean, "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."title_review_page"("p_media_type" "text", "p_tmdb_id" bigint, "p_after_followed" boolean, "p_after_created_at" timestamp with time zone, "p_after_id" "uuid", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."title_review_stats"("p_media_type" "text", "p_tmdb_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."title_review_stats"("p_media_type" "text", "p_tmdb_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."title_review_stats"("p_media_type" "text", "p_tmdb_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."title_review_stats"("p_media_type" "text", "p_tmdb_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."title_reviews_followed_first"("p_media_type" "text", "p_tmdb_id" bigint, "p_highlighted_review_id" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."title_reviews_followed_first"("p_media_type" "text", "p_tmdb_id" bigint, "p_highlighted_review_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."title_reviews_followed_first"("p_media_type" "text", "p_tmdb_id" bigint, "p_highlighted_review_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."title_reviews_followed_first"("p_media_type" "text", "p_tmdb_id" bigint, "p_highlighted_review_id" "uuid", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."tombstone_deleted_profile_comments"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tombstone_deleted_profile_comments"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."touch_person_review"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."touch_person_review"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_review_comment"("p_comment_id" "uuid", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_review_comment"("p_comment_id" "uuid", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_review_comment"("p_comment_id" "uuid", "p_body" "text") TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."person_review_works" TO "anon";
GRANT ALL ON TABLE "public"."person_review_works" TO "authenticated";
GRANT ALL ON TABLE "public"."person_review_works" TO "service_role";



GRANT ALL ON TABLE "public"."person_reviews" TO "anon";
GRANT ALL ON TABLE "public"."person_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."person_reviews" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."playlist_items" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."playlist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_items" TO "service_role";



GRANT ALL ON TABLE "public"."playlists" TO "anon";
GRANT ALL ON TABLE "public"."playlists" TO "authenticated";
GRANT ALL ON TABLE "public"."playlists" TO "service_role";



GRANT ALL ON TABLE "public"."review_comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."review_likes" TO "service_role";
GRANT SELECT ON TABLE "public"."review_likes" TO "authenticated";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."title_likes" TO "anon";
GRANT ALL ON TABLE "public"."title_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."title_likes" TO "service_role";



GRANT ALL ON TABLE "public"."viewing_events" TO "service_role";
GRANT SELECT ON TABLE "public"."viewing_events" TO "authenticated";



GRANT ALL ON TABLE "public"."watched" TO "anon";
GRANT ALL ON TABLE "public"."watched" TO "authenticated";
GRANT ALL ON TABLE "public"."watched" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






RESET ALL;

-- The auth schema is managed by Supabase and excluded from the schema dump.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_user();
