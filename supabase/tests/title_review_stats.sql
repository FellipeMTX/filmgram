begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-000000000071','stats1@example.test'),
 ('00000000-0000-0000-0000-000000000072','stats2@example.test');
insert into public.reviews (user_id, media_type, tmdb_id, rating) values
 ('00000000-0000-0000-0000-000000000071','movie',987654,1),
 ('00000000-0000-0000-0000-000000000072','movie',987654,5),
 ('00000000-0000-0000-0000-000000000071','tv',987654,4);
set local role anon;
select is((select review_count from public.title_review_stats('movie',987654)), 2::bigint, 'counts all title ratings');
select is((select average_rating from public.title_review_stats('movie',987654)), 3::numeric, 'averages all title ratings');
select is((select review_count from public.title_review_stats('tv',987654)), 1::bigint, 'separates media types');
select is((select average_rating from public.title_review_stats('movie',987655)), 0::numeric, 'empty title has zero average');
select * from finish();
rollback;
