create table public.person_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  person_tmdb_id bigint not null check (person_tmdb_id between 1 and 9007199254740991),
  rating integer not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, person_tmdb_id)
);
create index person_reviews_person_order_idx on public.person_reviews(person_tmdb_id, updated_at desc, id desc);
create table public.person_review_works (
  review_id uuid not null references public.person_reviews(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id bigint not null check (tmdb_id between 1 and 9007199254740991),
  position integer not null check (position between 1 and 10),
  primary key (review_id, media_type, tmdb_id),
  unique (review_id, position)
);
create function public.touch_person_review() returns trigger language plpgsql set search_path = '' as $$
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
create trigger person_reviews_touch before insert or update on public.person_reviews
for each row execute function public.touch_person_review();
revoke all on function public.touch_person_review() from public, anon, authenticated;
alter table public.person_reviews enable row level security;
alter table public.person_review_works enable row level security;
create policy person_reviews_read on public.person_reviews for select to anon, authenticated using (true);
create policy person_reviews_insert on public.person_reviews for insert to authenticated with check (user_id = (select auth.uid()));
create policy person_reviews_update on public.person_reviews for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy person_reviews_delete on public.person_reviews for delete to authenticated using (user_id = (select auth.uid()));
create policy person_review_works_read on public.person_review_works for select to anon, authenticated using (true);
create policy person_review_works_insert on public.person_review_works for insert to authenticated with check (
  exists (select 1 from public.person_reviews r where r.id = review_id and r.user_id = (select auth.uid()))
);
create policy person_review_works_update on public.person_review_works for update to authenticated using (
  exists (select 1 from public.person_reviews r where r.id = review_id and r.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.person_reviews r where r.id = review_id and r.user_id = (select auth.uid()))
);
create policy person_review_works_delete on public.person_review_works for delete to authenticated using (
  exists (select 1 from public.person_reviews r where r.id = review_id and r.user_id = (select auth.uid()))
);
grant select on public.person_reviews, public.person_review_works to anon, authenticated;
grant insert, update, delete on public.person_reviews, public.person_review_works to authenticated;

create function public.save_person_review(
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
     p_rating is null or p_rating not between 1 and 5 or
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
create function public.person_rating_stats(p_person_id bigint)
returns table(average_rating numeric, review_count bigint)
language sql stable security invoker set search_path = '' as $$
  select avg(r.rating), count(*) from public.person_reviews r where r.person_tmdb_id = p_person_id
$$;
revoke all on function public.save_person_review(bigint,integer,text,jsonb,timestamptz) from public, anon;
grant execute on function public.save_person_review(bigint,integer,text,jsonb,timestamptz) to authenticated;
revoke all on function public.person_rating_stats(bigint) from public;
grant execute on function public.person_rating_stats(bigint) to anon, authenticated;
