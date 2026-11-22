create function public.most_liked_titles(p_limit integer, p_media_type text)
returns table(media_type text, tmdb_id bigint, like_count bigint)
language sql stable security definer set search_path = '' as $$
  select l.media_type, l.tmdb_id, count(*) as like_count
  from public.title_likes l
  where l.media_type = p_media_type
  group by l.media_type, l.tmdb_id
  order by like_count desc, l.tmdb_id
  limit greatest(1, least(coalesce(p_limit, 12), 50))
$$;

revoke all on function public.most_liked_titles(integer, text) from public;
grant execute on function public.most_liked_titles(integer, text) to anon, authenticated;
