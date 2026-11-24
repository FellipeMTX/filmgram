begin;
create extension if not exists pgtap with schema extensions;
select plan(10);
insert into auth.users(id,email) values
 ('71000000-0000-0000-0000-000000000001','comment-like-1@example.test'),
 ('71000000-0000-0000-0000-000000000002','comment-like-2@example.test');
insert into public.reviews(id,user_id,media_type,tmdb_id,rating) values
 ('72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','movie',970000099,5);
insert into public.review_comments(id,review_id,user_id,body) values
 ('73000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','public comment');

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);
select is((select liked from public.set_review_comment_like('73000000-0000-0000-0000-000000000001',true)),true,'returns committed liked state');
select is((select like_count from public.set_review_comment_like('73000000-0000-0000-0000-000000000001',true)),1::bigint,'repeated likes are idempotent');
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000002',true);
select is((select liked from public.review_comment_like_summaries(array['73000000-0000-0000-0000-000000000001']::uuid[])),false,'viewer state reflects own likes only');
select is((select like_count from public.set_review_comment_like('73000000-0000-0000-0000-000000000001',false)),1::bigint,'cannot unlike on behalf of someone else');
select throws_ok($$select * from public.review_comment_likes$$,'42501',null,'individual likes are not readable');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select is((select like_count from public.review_comment_like_summaries(array['73000000-0000-0000-0000-000000000001']::uuid[])),1::bigint,'guests read the public aggregate');
select throws_ok($$select * from public.set_review_comment_like('73000000-0000-0000-0000-000000000001',true)$$,'42501',null,'guests cannot like');
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);
select public.delete_review_comment('73000000-0000-0000-0000-000000000001');
select is((select count(*) from public.review_comment_like_summaries(array['73000000-0000-0000-0000-000000000001']::uuid[])),0::bigint,'tombstones expose no like totals');
select throws_ok($$select * from public.set_review_comment_like('73000000-0000-0000-0000-000000000001',true)$$,'22023',null,'cannot like tombstones');
reset role;
delete from public.reviews where id='72000000-0000-0000-0000-000000000001';
select is((select count(*) from public.review_comment_likes where comment_id='73000000-0000-0000-0000-000000000001'),0::bigint,'review deletion cascades comment likes');
select * from finish();
rollback;
