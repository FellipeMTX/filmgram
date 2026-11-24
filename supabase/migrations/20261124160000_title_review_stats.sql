create index reviews_title_page_idx on public.reviews (media_type, tmdb_id, created_at desc, id desc);

create function public.title_review_stats(p_media_type text, p_tmdb_id bigint)
returns table (review_count bigint, average_rating numeric)
language sql stable security invoker set search_path = ''
as $$
  select count(*), coalesce(avg(r.rating), 0)
  from public.reviews r
  where r.media_type = p_media_type and r.tmdb_id = p_tmdb_id;
$$;

revoke all on function public.title_review_stats(text, bigint) from public;
grant execute on function public.title_review_stats(text, bigint) to anon, authenticated;
