-- Legacy stars and popcorn ratings use different scales. Clean explicitly
-- approved test data before deployment; never delete existing reviews here.
do $$
begin
  lock table public.reviews, public.person_reviews in access exclusive mode;
  if exists (select 1 from public.reviews) or
     exists (select 1 from public.person_reviews) then
    raise exception 'Review tables must be empty before switching to the popcorn rating scale'
      using hint = 'Review the target environment and explicitly clear only authorized test reviews before retrying.';
  end if;

  alter table public.reviews drop constraint reviews_rating_check,
    add constraint reviews_rating_check check (rating between 0 and 10);
  alter table public.person_reviews drop constraint person_reviews_rating_check,
    add constraint person_reviews_rating_check check (rating between 0 and 10);
end
$$;

create or replace function public.save_person_review(
  p_person_id bigint, p_rating integer, p_body text, p_works jsonb,
  p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
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
end $$;
