begin;
create extension if not exists pgtap with schema extensions;
select plan(18);
insert into auth.users(id,email) values
 ('d1000000-0000-0000-0000-000000000001','view1@example.test'),
 ('d1000000-0000-0000-0000-000000000002','view2@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-0000-0000-000000000001',true);
insert into public.watched(user_id,media_type,tmdb_id,media_title,genre_ids,watched_at) values
 ('d1000000-0000-0000-0000-000000000001','movie',1,'One','{18,18}',now() - interval '100 days'),
 ('d1000000-0000-0000-0000-000000000001','tv',2,'Two','{18}',now());
select is((select count(*) from public.viewing_events),2::bigint,'each mark creates one initial event');
select is((select count(*) from public.profile_viewing_titles('all',true)),0::bigint,'single viewing is not ranked');
select lives_ok($$select public.record_rewatch('movie',1,'d2000000-0000-0000-0000-000000000001')$$,'explicit rewatch recorded');
select lives_ok($$select public.record_rewatch('movie',1,'d2000000-0000-0000-0000-000000000001')$$,'retry succeeds');
select is((select count(*) from public.viewing_events),3::bigint,'retry does not duplicate');
select is((select watch_count from public.profile_viewing_titles('all',true) where tmdb_id=1),2::bigint,'ranking counts events');
select is((select count(*) from public.profile_viewing_titles('30d',true)),0::bigint,'ranking period filters events');
select is((select count(*) from public.profile_viewing_titles('all',false,12,0,'movie')),1::bigint,'type filter applies before pagination');
select is((select total_count from public.profile_viewing_titles('all',false,12,0,'tv')),1::bigint,'total reflects type filter');
select is((select movie_count from public.profile_viewing_stats('30d')),1::bigint,'rewatch includes distinct movie in period');
select is((select genre_counts from public.profile_viewing_stats('all')),'{"18":2}'::jsonb,'genres count titles once');
select throws_ok($$select public.record_rewatch('tv',2,'d2000000-0000-0000-0000-000000000001')$$,'22023',null,'request id cannot change title');
select throws_ok($$insert into public.viewing_events(user_id,media_type,tmdb_id,media_title,kind) values ('d1000000-0000-0000-0000-000000000001','movie',3,'Forged','initial')$$,'42501',null,'direct event writes forbidden');
delete from public.watched where media_type='movie' and tmdb_id=1;
select is((select count(*) from public.viewing_events where tmdb_id=1),1::bigint,'unmark removes initial but retains explicit event');
select lives_ok($$select public.record_rewatch('movie',1,'d2000000-0000-0000-0000-000000000001')$$,'retry still succeeds after unmark');
select throws_ok($$select public.record_rewatch('movie',1,'d2000000-0000-0000-0000-000000000002')$$,'22023',null,'new rewatch requires watched mark');
select set_config('request.jwt.claim.sub','d1000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.viewing_events),0::bigint,'other users cannot see events');
select is((select count(*) from public.profile_viewing_titles()),0::bigint,'private dashboard belongs to authenticated user');
select * from finish();
rollback;
