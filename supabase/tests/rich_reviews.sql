begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users(id,email) values
 ('74000000-0000-0000-0000-000000000001','rich-review-1@example.test'),
 ('74000000-0000-0000-0000-000000000002','rich-review-2@example.test');
insert into public.follows(follower_id, following_id) values
 ('74000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000001');
insert into public.reviews(id,user_id,media_type,tmdb_id,rating,body,youtube_video_id) values
 ('75000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','movie',980000099,5,'previous review','dQw4w9WgXcQ');
select is((select body_document from public.reviews where id='75000000-0000-0000-0000-000000000001'),null::jsonb,'legacy plain review stays valid');
select is((select youtube_video_id from public.reviews where id='75000000-0000-0000-0000-000000000001'),'dQw4w9WgXcQ','legacy video survives without migration');
set local role authenticated;
select set_config('request.jwt.claim.sub','74000000-0000-0000-0000-000000000001',true);
select lives_ok($$update public.reviews set body_document='{"blocks":[{"type":"paragraph","children":[{"text":"Bold text","bold":true}]}]}' where id='75000000-0000-0000-0000-000000000001'$$,'existing author can write structured content');
select throws_ok($$update public.reviews set body_document='{"other":[]}' where id='75000000-0000-0000-0000-000000000001'$$,'23514',null,'database rejects unsupported root shape');
select set_config('request.jwt.claim.sub','74000000-0000-0000-0000-000000000002',true);
select is((select body_document->'blocks'->0->'children'->0->>'text' from public.following_feed() where id='75000000-0000-0000-0000-000000000001'),'Bold text','follow feed projects structured content');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select is((select body_document->'blocks'->0->'children'->0->>'text' from public.title_reviews_followed_first('movie',980000099,null,10) where id='75000000-0000-0000-0000-000000000001'),'Bold text','title reviews project structured content for visitors');
select * from finish();
rollback;
