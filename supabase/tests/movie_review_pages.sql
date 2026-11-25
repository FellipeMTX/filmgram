begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users(id, email)
select ('70100000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'movie-review-page-' || n || '@example.test'
from generate_series(1, 24) AS ids(n);

insert into public.follows(follower_id, following_id)
values ('70100000-0000-0000-0000-000000000001', '70100000-0000-0000-0000-000000000002');

insert into public.reviews(id, user_id, media_type, tmdb_id, rating, created_at)
select ('70200000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('70100000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'movie', 700000151, 8, case when n = 2 then '2025-01-01' else '2026-01-01' end::timestamptz
from generate_series(2, 24) AS ids(n);

insert into public.reviews(user_id, media_type, tmdb_id, rating, created_at)
values ('70100000-0000-0000-0000-000000000002', 'tv', 700000151, 8, '2026-01-01'),
  ('70100000-0000-0000-0000-000000000002', 'movie', 700000152, 9, '2026-01-01');

set local role authenticated;
select set_config('request.jwt.claim.sub', '70100000-0000-0000-0000-000000000001', true);

select results_eq(
  $$select id from public.movie_review_page(700000151, p_limit => 2)$$,
  $$values ('70200000-0000-0000-0000-000000000002'::uuid),
           ('70200000-0000-0000-0000-000000000024'::uuid)$$,
  'follows outrank dates and tied dates are ordered by descending review ID'
);

select is((select count(*) from public.movie_review_page(700000151, p_limit => 250)), 21::bigint,
  'the RPC caps a page at twenty rows and one lookahead row');

select results_eq(
  $$select id from public.movie_review_page(
      700000151, false, '2026-01-01', '70200000-0000-0000-0000-000000000006'
    )$$,
  $$values ('70200000-0000-0000-0000-000000000005'::uuid),
           ('70200000-0000-0000-0000-000000000004'::uuid),
           ('70200000-0000-0000-0000-000000000003'::uuid)$$,
  'the cursor returns the last three reviews without duplicates at the page boundary'
);

select is((select count(*) from public.movie_review_page(700000152)), 1::bigint,
  'only reviews for the matching film are included');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select results_eq(
  $$select id from public.movie_review_page(700000151, p_limit => 2)$$,
  $$values ('70200000-0000-0000-0000-000000000024'::uuid),
           ('70200000-0000-0000-0000-000000000023'::uuid)$$,
  'guests see chronological order with the stable tiebreaker'
);

select is((select count(*) from public.movie_review_page(700000151) where followed), 0::bigint,
  'the RPC exposes no other viewer follow state to guests');

select * from finish();
rollback;
