begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-000000000011','feed1@example.test'),
 ('00000000-0000-0000-0000-000000000012','feed2@example.test'),
 ('00000000-0000-0000-0000-000000000013','feed3@example.test');
insert into public.follows (follower_id, following_id) values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012');
insert into public.reviews (id, user_id, media_type, tmdb_id, rating, created_at)
select ('10000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000012', 'movie', n, 5, '2024-01-01'::timestamptz from generate_series(1,15) n;
insert into public.reviews (user_id, media_type, tmdb_id, rating, created_at)
select '00000000-0000-0000-0000-000000000013', 'movie', n, 5, '2025-01-01'::timestamptz from generate_series(1,20) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
select is((select count(*) from public.following_feed()),13::bigint,'filters before limiting');
select is((select min(tmdb_id) from public.following_feed()),3::bigint,'stable id order for equal timestamps');
select is((select count(*) from public.following_feed('2024-01-01','10000000-0000-0000-0000-000000000004')),3::bigint,'cursor returns remaining rows');
select is((select count(*) from public.following_feed('2024-01-01',null)),0::bigint,'partial cursor rejected');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',true);
select is((select count(*) from public.following_feed()),0::bigint,'feed isolated by authenticated user');
set local role anon;
select throws_ok($$select * from public.following_feed()$$,'42501',null,'anonymous cannot execute feed');
select * from finish();
rollback;
