begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
insert into auth.users(id,email) values
 ('60000000-0000-0000-0000-000000000001','viewer-rank@example.test'),
 ('60000000-0000-0000-0000-000000000002','followed-rank@example.test'),
 ('60000000-0000-0000-0000-000000000003','newer-rank@example.test'),
 ('60000000-0000-0000-0000-000000000004','other-rank@example.test');
insert into public.follows(follower_id,following_id) values
 ('60000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002');
insert into public.reviews(id,user_id,media_type,tmdb_id,rating,created_at) values
 ('69000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','tv',700000099,5,'2024-01-01'),
 ('69000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000003','tv',700000099,4,'2025-01-01'),
 ('69000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000004','tv',700000099,3,'2025-01-01');
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
select results_eq(
 $$select id::text from public.title_reviews_followed_first('tv',700000099,null,2)$$,
 $$values ('69000000-0000-0000-0000-000000000001'::text), ('69000000-0000-0000-0000-000000000003'::text)$$,
 'followed authors rank before the limit, and tied timestamps have an id tiebreaker');
select results_eq(
 $$select id::text from public.title_reviews_followed_first('tv',700000099,'69000000-0000-0000-0000-000000000002',2)$$,
 $$values ('69000000-0000-0000-0000-000000000001'::text), ('69000000-0000-0000-0000-000000000003'::text), ('69000000-0000-0000-0000-000000000002'::text)$$,
 'a deep-linked review beyond the page is visible without promotion');
select is((select count(*) from public.title_reviews_followed_first('tv',700000099,'69000000-0000-0000-0000-000000000001',2)),2::bigint,'deep link to in-page review does not duplicate it');
select is((select count(*) from public.title_reviews_followed_first('movie',700000099,'69000000-0000-0000-0000-000000000002',2)),0::bigint,'deep link cannot include a review of a different title');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select results_eq(
 $$select id::text from public.title_reviews_followed_first('tv',700000099,null,3)$$,
 $$values ('69000000-0000-0000-0000-000000000003'::text), ('69000000-0000-0000-0000-000000000002'::text), ('69000000-0000-0000-0000-000000000001'::text)$$,
 'guests see chronological order with a stable id tiebreaker');
select * from finish();
rollback;
